#!/usr/bin/env node

/**
 * dependency-validator.js - Skill dependency validation system
 * Part of LCBP3-DMS Phase 3 enhancements
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

// Configuration
const BASE_DIR = path.resolve(__dirname, '../..');
const AGENTS_DIR = path.join(BASE_DIR, '.agents');
const SKILLS_DIR = path.join(AGENTS_DIR, 'skills');
const WORKFLOWS_DIR = path.join(BASE_DIR, '.windsurf', 'workflows');

// Dependency validation class
class DependencyValidator {
    constructor() {
        this.validationResults = {
            timestamp: new Date().toISOString(),
            dependency_graph: {},
            circular_dependencies: [],
            missing_dependencies: [],
            orphaned_skills: [],
            dependency_chains: {},
            validation_summary: {
                total_skills: 0,
                skills_with_dependencies: 0,
                circular_dependencies_found: 0,
                missing_dependencies_found: 0,
                orphaned_skills_found: 0,
                max_dependency_depth: 0,
                validation_status: 'unknown'
            }
        };
    }

    log(message, level = 'info') {
        const colors = {
            info: '\x1b[36m',    // Cyan
            pass: '\x1b[32m',    // Green
            fail: '\x1b[31m',    // Red
            warn: '\x1b[33m',    // Yellow
            critical: '\x1b[35m', // Magenta
            reset: '\x1b[0m'
        };
        
        const color = colors[level] || colors.info;
        console.log(`${color}[${level.toUpperCase()}] ${message}${colors.reset}`);
    }

    extractSkillDependencies(skillPath, skillName) {
        const skillMdPath = path.join(skillPath, 'SKILL.md');
        
        if (!fs.existsSync(skillMdPath)) {
            this.log(`No SKILL.md found for ${skillName}`, 'warn');
            return { dependencies: [], handoffs: [], error: 'SKILL.md not found' };
        }

        try {
            const content = fs.readFileSync(skillMdPath, 'utf8');
            
            // Extract dependencies from front matter
            let dependencies = [];
            let handoffs = [];
            
            const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
            if (frontMatterMatch) {
                try {
                    const frontMatter = yaml.load(frontMatterMatch[1]);
                    
                    // Handle depends-on field
                    if (frontMatter['depends-on']) {
                        if (Array.isArray(frontMatter['depends-on'])) {
                            dependencies = frontMatter['depends-on'];
                        } else {
                            dependencies = [frontMatter['depends-on']];
                        }
                    }
                    
                    // Handle handoffs field
                    if (frontMatter.handoffs && Array.isArray(frontMatter.handoffs)) {
                        handoffs = frontMatter.handoffs.map(h => h.agent);
                    }
                    
                } catch (yamlError) {
                    this.log(`Invalid YAML in ${skillName} front matter: ${yamlError.message}`, 'warn');
                }
            }

            // Also extract skill references from content
            const contentSkillRefs = content.match(/@speckit-\w+/g) || [];
            const contentDependencies = contentSkillRefs.map(ref => ref.replace('@', ''));
            
            // Merge dependencies (avoid duplicates)
            const allDependencies = [...new Set([...dependencies, ...contentDependencies])];
            
            return { 
                dependencies: allDependencies, 
                handoffs: handoffs,
                content_references: contentSkillRefs,
                front_matter_dependencies: dependencies,
                error: null 
            };

        } catch (error) {
            this.log(`Error reading ${skillName}: ${error.message}`, 'warn');
            return { dependencies: [], handoffs: [], error: error.message };
        }
    }

    buildDependencyGraph() {
        this.log('Building dependency graph...', 'info');
        
        if (!fs.existsSync(SKILLS_DIR)) {
            this.log('Skills directory not found', 'fail');
            return;
        }

        const skillDirs = fs.readdirSync(SKILLS_DIR).filter(item => {
            const itemPath = path.join(SKILLS_DIR, item);
            return fs.statSync(itemPath).isDirectory();
        });

        this.validationResults.validation_summary.total_skills = skillDirs.length;

        // Extract dependencies for each skill
        for (const skillDir of skillDirs) {
            const skillPath = path.join(SKILLS_DIR, skillDir);
            const dependencyInfo = this.extractSkillDependencies(skillPath, skillDir);
            
            this.validationResults.dependency_graph[skillDir] = dependencyInfo;
            
            if (dependencyInfo.dependencies.length > 0 || dependencyInfo.handoffs.length > 0) {
                this.validationResults.validation_summary.skills_with_dependencies++;
            }
        }

        this.log(`Analyzed ${skillDirs.length} skills`, 'info');
        this.log(`Skills with dependencies: ${this.validationResults.validation_summary.skills_with_dependencies}`, 'info');
    }

    validateDependencies() {
        this.log('Validating dependencies...', 'info');
        
        const { dependency_graph } = this.validationResults;
        const allSkills = Object.keys(dependency_graph);
        
        // Check for missing dependencies
        for (const [skillName, dependencyInfo] of Object.entries(dependency_graph)) {
            for (const dependency of dependencyInfo.dependencies) {
                if (!allSkills.includes(dependency)) {
                    this.validationResults.missing_dependencies.push({
                        skill: skillName,
                        missing_dependency: dependency,
                        dependency_type: 'depends-on'
                    });
                    this.validationResults.validation_summary.missing_dependencies_found++;
                    this.log(`Missing dependency: ${skillName} depends on ${dependency}`, 'fail');
                }
            }
            
            for (const handoff of dependencyInfo.handoffs) {
                if (!allSkills.includes(handoff)) {
                    this.validationResults.missing_dependencies.push({
                        skill: skillName,
                        missing_dependency: handoff,
                        dependency_type: 'handoff'
                    });
                    this.validationResults.validation_summary.missing_dependencies_found++;
                    this.log(`Missing handoff: ${skillName} hands off to ${handoff}`, 'fail');
                }
            }
        }

        // Check for orphaned skills (no one depends on them)
        const dependedOnSkills = new Set();
        for (const dependencyInfo of Object.values(dependency_graph)) {
            dependencyInfo.dependencies.forEach(dep => dependedOnSkills.add(dep));
            dependencyInfo.handoffs.forEach(handoff => dependedOnSkills.add(handoff));
        }

        for (const skill of allSkills) {
            if (!dependedOnSkills.has(skill) && skill !== 'speckit-constitution') {
                // Constitution is allowed to be orphaned (it's a starting point)
                this.validationResults.orphaned_skills.push(skill);
                this.validationResults.validation_summary.orphaned_skills_found++;
                this.log(`Orphaned skill: ${skill} (no dependencies on it)`, 'warn');
            }
        }
    }

    detectCircularDependencies() {
        this.log('Detecting circular dependencies...', 'info');
        
        const { dependency_graph } = this.validationResults;
        const visited = new Set();
        const recursionStack = new Set();
        const circularDeps = [];

        function dfs(skillName, path = []) {
            if (recursionStack.has(skillName)) {
                // Found circular dependency
                const cycleStart = path.indexOf(skillName);
                const cycle = path.slice(cycleStart).concat(skillName);
                circularDeps.push(cycle);
                return;
            }

            if (visited.has(skillName)) {
                return;
            }

            visited.add(skillName);
            recursionStack.add(skillName);
            path.push(skillName);

            const dependencyInfo = dependency_graph[skillName];
            if (dependencyInfo) {
                for (const dependency of dependencyInfo.dependencies) {
                    dfs(dependency, [...path]);
                }
            }

            recursionStack.delete(skillName);
        }

        // Run DFS from each skill
        for (const skillName of Object.keys(dependency_graph)) {
            if (!visited.has(skillName)) {
                dfs(skillName);
            }
        }

        this.validationResults.circular_dependencies = circularDeps;
        this.validationResults.validation_summary.circular_dependencies_found = circularDeps.length;

        if (circularDeps.length > 0) {
            this.log(`Found ${circularDeps.length} circular dependencies:`, 'critical');
            circularDeps.forEach((cycle, index) => {
                this.log(`  ${index + 1}. ${cycle.join(' -> ')}`, 'critical');
            });
        } else {
            this.log('No circular dependencies found', 'pass');
        }
    }

    calculateDependencyChains() {
        this.log('Calculating dependency chains...', 'info');
        
        const { dependency_graph } = this.validationResults;
        const chains = {};

        function calculateDepth(skillName, visited = new Set()) {
            if (visited.has(skillName)) {
                return 0; // Circular dependency protection
            }

            visited.add(skillName);
            
            const dependencyInfo = dependency_graph[skillName];
            if (!dependencyInfo || dependencyInfo.dependencies.length === 0) {
                return 1;
            }

            let maxDepth = 0;
            for (const dependency of dependencyInfo.dependencies) {
                const depth = calculateDepth(dependency, new Set(visited));
                maxDepth = Math.max(maxDepth, depth);
            }

            return maxDepth + 1;
        }

        function getDependencyChain(skillName) {
            const dependencyInfo = dependency_graph[skillName];
            if (!dependencyInfo || dependencyInfo.dependencies.length === 0) {
                return [skillName];
            }

            const chains = [];
            for (const dependency of dependencyInfo.dependencies) {
                const depChain = getDependencyChain(dependency);
                chains.push(depChain.concat(skillName));
            }

            // Return the longest chain
            return chains.reduce((longest, current) => 
                current.length > longest.length ? current : longest, [skillName]
            );
        }

        for (const skillName of Object.keys(dependency_graph)) {
            const depth = calculateDepth(skillName);
            const chain = getDependencyChain(skillName);
            
            chains[skillName] = {
                depth: depth,
                chain: chain,
                chain_length: chain.length
            };
        }

        this.validationResults.dependency_chains = chains;
        
        const maxDepth = Math.max(...Object.values(chains).map(c => c.depth));
        this.validationResults.validation_summary.max_dependency_depth = maxDepth;
        
        this.log(`Maximum dependency depth: ${maxDepth}`, 'info');
    }

    validateWorkflowDependencies() {
        this.log('Validating workflow dependencies...', 'info');
        
        if (!fs.existsSync(WORKFLOWS_DIR)) {
            this.log('Workflows directory not found', 'warn');
            return;
        }

        const workflowFiles = fs.readdirSync(WORKFLOWS_DIR).filter(file => file.endsWith('.md'));
        const allSkills = Object.keys(this.validationResults.dependency_graph);

        for (const workflowFile of workflowFiles) {
            const workflowPath = path.join(WORKFLOWS_DIR, workflowFile);
            
            try {
                const content = fs.readFileSync(workflowPath, 'utf8');
                const skillReferences = content.match(/@speckit-\w+/g) || [];
                
                for (const skillRef of skillReferences) {
                    const skillName = skillRef.replace('@', '');
                    
                    if (!allSkills.includes(skillName)) {
                        this.validationResults.missing_dependencies.push({
                            workflow: workflowFile,
                            missing_dependency: skillName,
                            dependency_type: 'workflow-reference'
                        });
                        this.validationResults.validation_summary.missing_dependencies_found++;
                        this.log(`Workflow ${workflowFile} references missing skill: ${skillRef}`, 'fail');
                    }
                }
                
            } catch (error) {
                this.log(`Error reading workflow ${workflowFile}: ${error.message}`, 'warn');
            }
        }
    }

    generateDependencyReport() {
        this.log('Generating dependency report...', 'info');
        
        // Determine overall validation status
        const summary = this.validationResults.validation_summary;
        
        if (summary.circular_dependencies_found > 0) {
            summary.validation_status = 'critical';
        } else if (summary.missing_dependencies_found > 0) {
            summary.validation_status = 'failed';
        } else if (summary.orphaned_skills_found > 0) {
            summary.validation_status = 'warning';
        } else {
            summary.validation_status = 'passed';
        }

        // Save report
        const reportPath = path.join(AGENTS_DIR, 'reports', 'dependency-validation.json');
        const reportsDir = path.dirname(reportPath);
        
        if (!fs.existsSync(reportsDir)) {
            fs.mkdirSync(reportsDir, { recursive: true });
        }

        fs.writeFileSync(reportPath, JSON.stringify(this.validationResults, null, 2));
        this.log(`Dependency validation report saved to: ${reportPath}`, 'info');
    }

    printSummary() {
        const summary = this.validationResults.validation_summary;
        
        this.log('=== Dependency Validation Summary ===', 'info');
        this.log(`Total skills: ${summary.total_skills}`, 'info');
        this.log(`Skills with dependencies: ${summary.skills_with_dependencies}`, 'info');
        this.log(`Circular dependencies: ${summary.circular_dependencies_found}`, summary.circular_dependencies_found > 0 ? 'critical' : 'pass');
        this.log(`Missing dependencies: ${summary.missing_dependencies_found}`, summary.missing_dependencies_found > 0 ? 'fail' : 'pass');
        this.log(`Orphaned skills: ${summary.orphaned_skills_found}`, summary.orphaned_skills_found > 0 ? 'warn' : 'info');
        this.log(`Max dependency depth: ${summary.max_dependency_depth}`, 'info');
        this.log(`Validation status: ${summary.validation_status.toUpperCase()}`, 
            summary.validation_status === 'passed' ? 'pass' : 
            summary.validation_status === 'warning' ? 'warn' : 'fail');

        // Show longest dependency chains
        const chains = this.validationResults.dependency_chains;
        const sortedChains = Object.entries(chains)
            .sort(([,a], [,b]) => b.depth - a.depth)
            .slice(0, 3);

        if (sortedChains.length > 0) {
            this.log('Top 3 longest dependency chains:', 'info');
            sortedChains.forEach(([skillName, chainInfo], index) => {
                this.log(`  ${index + 1}. ${chainInfo.chain.join(' -> ')} (depth: ${chainInfo.depth})`, 'info');
            });
        }
    }

    async runDependencyValidation() {
        this.log('Starting dependency validation...', 'info');
        this.log(`Base directory: ${BASE_DIR}`, 'info');
        
        // Build dependency graph
        this.buildDependencyGraph();
        
        // Validate dependencies
        this.validateDependencies();
        
        // Detect circular dependencies
        this.detectCircularDependencies();
        
        // Calculate dependency chains
        this.calculateDependencyChains();
        
        // Validate workflow dependencies
        this.validateWorkflowDependencies();
        
        // Generate report
        this.generateDependencyReport();
        
        // Print summary
        this.printSummary();
        
        return this.validationResults;
    }
}

// CLI interface
async function main() {
    const validator = new DependencyValidator();
    
    try {
        const results = await validator.runDependencyValidation();
        const status = results.validation_summary.validation_status;
        process.exit(status === 'passed' || status === 'warning' ? 0 : 1);
    } catch (error) {
        console.error('Dependency validation failed:', error);
        process.exit(1);
    }
}

// Export for use in other modules
module.exports = { DependencyValidator };

// Run if called directly
if (require.main === module) {
    main();
}
