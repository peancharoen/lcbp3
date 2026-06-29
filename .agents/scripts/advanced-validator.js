#!/usr/bin/env node

/**
 * advanced-validator.js - Advanced validation capabilities for .agents
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

// Advanced validation class
class AdvancedValidator {
    constructor() {
        this.validationResults = {
            timestamp: new Date().toISOString(),
            validations: {},
            summary: {
                total_validations: 0,
                passed_validations: 0,
                failed_validations: 0,
                warnings: 0,
                critical_issues: 0
            }
        };
        this.criticalIssues = [];
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

    validateSkillFrontMatter(skillPath, skillName) {
        const skillMdPath = path.join(skillPath, 'SKILL.md');
        
        if (!fs.existsSync(skillMdPath)) {
            this.addValidationResult(`skill_${skillName}_frontmatter`, 'fail', {
                message: 'SKILL.md file not found',
                path: skillMdPath
            });
            return false;
        }

        try {
            const content = fs.readFileSync(skillMdPath, 'utf8');
            const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
            
            if (!frontMatterMatch) {
                this.addValidationResult(`skill_${skillName}_frontmatter`, 'fail', {
                    message: 'No front matter found',
                    path: skillMdPath
                });
                return false;
            }

            try {
                const frontMatter = yaml.load(frontMatterMatch[1]);
                const requiredFields = ['name', 'description', 'version'];
                const missingFields = requiredFields.filter(field => !frontMatter[field]);
                
                if (missingFields.length > 0) {
                    this.addValidationResult(`skill_${skillName}_frontmatter`, 'fail', {
                        message: `Missing required fields: ${missingFields.join(', ')}`,
                        missing_fields: missingFields,
                        front_matter: frontMatter,
                        path: skillMdPath
                    });
                    return false;
                }

                // Validate version format
                const versionPattern = /^\d+\.\d+\.\d+$/;
                if (!versionPattern.test(frontMatter.version)) {
                    this.addValidationResult(`skill_${skillName}_version_format`, 'warn', {
                        message: 'Version format should be X.Y.Z',
                        version: frontMatter.version,
                        path: skillMdPath
                    });
                }

                // Validate dependencies if present
                if (frontMatter['depends-on']) {
                    const dependencies = Array.isArray(frontMatter['depends-on']) 
                        ? frontMatter['depends-on'] 
                        : [frontMatter['depends-on']];
                    
                    for (const dep of dependencies) {
                        const depPath = path.join(SKILLS_DIR, dep);
                        if (!fs.existsSync(depPath)) {
                            this.addValidationResult(`skill_${skillName}_dependency_${dep}`, 'critical', {
                                message: `Dependency not found: ${dep}`,
                                dependency: dep,
                                path: skillMdPath
                            });
                        }
                    }
                }

                this.addValidationResult(`skill_${skillName}_frontmatter`, 'pass', {
                    message: 'Front matter is valid',
                    front_matter: frontMatter,
                    path: skillMdPath
                });
                return true;

            } catch (yamlError) {
                this.addValidationResult(`skill_${skillName}_frontmatter`, 'fail', {
                    message: `Invalid YAML in front matter: ${yamlError.message}`,
                    path: skillMdPath
                });
                return false;
            }

        } catch (error) {
            this.addValidationResult(`skill_${skillName}_frontmatter`, 'fail', {
                message: `Error reading SKILL.md: ${error.message}`,
                path: skillMdPath
            });
            return false;
        }
    }

    validateSkillContent(skillPath, skillName) {
        const skillMdPath = path.join(skillPath, 'SKILL.md');
        
        if (!fs.existsSync(skillMdPath)) {
            return false;
        }

        try {
            const content = fs.readFileSync(skillMdPath, 'utf8');
            
            // Check for required sections
            const requiredSections = ['## Role', '## Task'];
            const missingSections = requiredSections.filter(section => !content.includes(section));
            
            if (missingSections.length > 0) {
                this.addValidationResult(`skill_${skillName}_content`, 'fail', {
                    message: `Missing required sections: ${missingSections.join(', ')}`,
                    missing_sections: missingSections,
                    path: skillMdPath
                });
                return false;
            }

            // Check for forbidden patterns
            const forbiddenPatterns = [
                { pattern: /TODO.*FIX/gi, message: 'TODO items should be resolved' },
                { pattern: /FIXME/gi, message: 'FIXME items should be addressed' },
                { pattern: /XXX/gi, message: 'XXX markers should be replaced' }
            ];

            for (const { pattern, message } of forbiddenPatterns) {
                if (pattern.test(content)) {
                    this.addValidationResult(`skill_${skillName}_forbidden_patterns`, 'warn', {
                        message: `${message} found in content`,
                        pattern: pattern.toString(),
                        path: skillMdPath
                    });
                }
            }

            // Validate content length
            const contentLength = content.length;
            if (contentLength < 500) {
                this.addValidationResult(`skill_${skillName}_content_length`, 'warn', {
                    message: 'Skill content seems too short',
                    length: contentLength,
                    path: skillMdPath
                });
            }

            this.addValidationResult(`skill_${skillName}_content`, 'pass', {
                message: 'Skill content is valid',
                length: contentLength,
                path: skillMdPath
            });
            return true;

        } catch (error) {
            this.addValidationResult(`skill_${skillName}_content`, 'fail', {
                message: `Error validating content: ${error.message}`,
                path: skillMdPath
            });
            return false;
        }
    }

    validateWorkflowStructure(workflowPath, workflowName) {
        if (!fs.existsSync(workflowPath)) {
            this.addValidationResult(`workflow_${workflowName}_exists`, 'fail', {
                message: 'Workflow file not found',
                path: workflowPath
            });
            return false;
        }

        try {
            const content = fs.readFileSync(workflowPath, 'utf8');
            
            // Check for markdown headers
            if (!content.includes('#')) {
                this.addValidationResult(`workflow_${workflowName}_structure`, 'fail', {
                    message: 'No markdown headers found',
                    path: workflowPath
                });
                return false;
            }

            // Check for workflow-specific patterns
            const hasWorkflowContent = content.length > 200;
            if (!hasWorkflowContent) {
                this.addValidationResult(`workflow_${workflowName}_content`, 'warn', {
                    message: 'Workflow content seems too short',
                    length: content.length,
                    path: workflowPath
                });
            }

            // Validate skill references
            const skillReferences = content.match(/@speckit-\w+/g) || [];
            for (const skillRef of skillReferences) {
                const skillName = skillRef.replace('@', '');
                const skillPath = path.join(SKILLS_DIR, skillName);
                
                if (!fs.existsSync(skillPath)) {
                    this.addValidationResult(`workflow_${workflowName}_skill_ref_${skillName}`, 'critical', {
                        message: `Workflow references non-existent skill: ${skillRef}`,
                        skill_reference: skillRef,
                        path: workflowPath
                    });
                }
            }

            this.addValidationResult(`workflow_${workflowName}_structure`, 'pass', {
                message: 'Workflow structure is valid',
                skill_references: skillReferences,
                path: workflowPath
            });
            return true;

        } catch (error) {
            this.addValidationResult(`workflow_${workflowName}_structure`, 'fail', {
                message: `Error validating workflow: ${error.message}`,
                path: workflowPath
            });
            return false;
        }
    }

    validateCrossReferences() {
        this.log('Validating cross-references...', 'info');

        // Check README.md references
        const readmePath = path.join(AGENTS_DIR, 'README.md');
        if (fs.existsSync(readmePath)) {
            const readmeContent = fs.readFileSync(readmePath, 'utf8');
            
            // Check if README references correct workflow path
            if (readmeContent.includes('.agents/workflows') && !readmeContent.includes('.windsurf/workflows')) {
                this.addValidationResult('readme_workflow_reference', 'critical', {
                    message: 'README.md references .agents/workflows instead of .windsurf/workflows',
                    path: readmePath
                });
            }

            // Check version consistency in README
            const versionMatches = readmeContent.match(/v?(\d+\.\d+\.\d+)/g) || [];
            const uniqueVersions = [...new Set(versionMatches)];
            
            if (uniqueVersions.length > 1) {
                this.addValidationResult('readme_version_consistency', 'warn', {
                    message: 'Multiple versions found in README.md',
                    versions: uniqueVersions,
                    path: readmePath
                });
            }
        }

        // Check skills.md references
        const skillsMdPath = path.join(SKILLS_DIR, 'skills.md');
        if (fs.existsSync(skillsMdPath)) {
            const skillsContent = fs.readFileSync(skillsMdPath, 'utf8');
            
            // Validate skill dependency matrix
            if (skillsContent.includes('## Skill Dependency Matrix')) {
                this.addValidationResult('skills_dependency_matrix', 'pass', {
                    message: 'Skills documentation includes dependency matrix',
                    path: skillsMdPath
                });
            } else {
                this.addValidationResult('skills_dependency_matrix', 'warn', {
                    message: 'Skills documentation missing dependency matrix',
                    path: skillsMdPath
                });
            }
        }
    }

    validateSecurityCompliance() {
        this.log('Validating security compliance...', 'info');

        // Check for security patterns in rules
        const securityRulePath = path.join(AGENTS_DIR, 'rules', '02-security.md');
        if (fs.existsSync(securityRulePath)) {
            const securityContent = fs.readFileSync(securityRulePath, 'utf8');
            
            const requiredSecurityTopics = [
                'authentication',
                'authorization',
                'rbac',
                'validation',
                'audit'
            ];

            const missingTopics = requiredSecurityTopics.filter(topic => 
                !securityContent.toLowerCase().includes(topic.toLowerCase())
            );

            if (missingTopics.length > 0) {
                this.addValidationResult('security_rules_completeness', 'warn', {
                    message: `Security rules missing topics: ${missingTopics.join(', ')}`,
                    missing_topics: missingTopics,
                    path: securityRulePath
                });
            } else {
                this.addValidationResult('security_rules_completeness', 'pass', {
                    message: 'Security rules cover all required topics',
                    path: securityRulePath
                });
            }
        }

        // Check for ADR-019 compliance in rules
        const uuidRulePath = path.join(AGENTS_DIR, 'rules', '01-adr-019-uuid.md');
        if (fs.existsSync(uuidRulePath)) {
            const uuidContent = fs.readFileSync(uuidRulePath, 'utf8');
            
            const criticalUuidRules = [
                'parseInt',
                'Number(',
                'publicId',
                '@Exclude()'
            ];

            const missingRules = criticalUuidRules.filter(rule => 
                !uuidContent.includes(rule)
            );

            if (missingRules.length > 0) {
                this.addValidationResult('uuid_rules_completeness', 'critical', {
                    message: `UUID rules missing critical patterns: ${missingRules.join(', ')}`,
                    missing_patterns: missingRules,
                    path: uuidRulePath
                });
            } else {
                this.addValidationResult('uuid_rules_completeness', 'pass', {
                    message: 'UUID rules cover all critical patterns',
                    path: uuidRulePath
                });
            }
        }
    }

    validatePerformanceMetrics() {
        this.log('Validating performance metrics...', 'info');

        // Check file sizes
        const criticalFiles = [
            { path: path.join(AGENTS_DIR, 'README.md'), name: 'README.md' },
            { path: path.join(SKILLS_DIR, 'skills.md'), name: 'skills.md' },
            { path: path.join(AGENTS_DIR, 'skills', 'VERSION'), name: 'VERSION' }
        ];

        for (const file of criticalFiles) {
            if (fs.existsSync(file.path)) {
                const stats = fs.statSync(file.path);
                const sizeKB = stats.size / 1024;
                
                if (sizeKB > 100) {
                    this.addValidationResult(`file_size_${file.name}`, 'warn', {
                        message: `File ${file.name} is large (${sizeKB.toFixed(1)}KB)`,
                        size_kb: sizeKB,
                        path: file.path
                    });
                } else {
                    this.addValidationResult(`file_size_${file.name}`, 'pass', {
                        message: `File ${file.name} size is acceptable`,
                        size_kb: sizeKB,
                        path: file.path
                    });
                }
            }
        }

        // Check directory structure depth
        function getDirectoryDepth(dirPath, currentDepth = 0) {
            let maxDepth = currentDepth;
            
            if (fs.existsSync(dirPath)) {
                const items = fs.readdirSync(dirPath);
                for (const item of items) {
                    const itemPath = path.join(dirPath, item);
                    if (fs.statSync(itemPath).isDirectory()) {
                        const depth = getDirectoryDepth(itemPath, currentDepth + 1);
                        maxDepth = Math.max(maxDepth, depth);
                    }
                }
            }
            
            return maxDepth;
        }

        const agentsDepth = getDirectoryDepth(AGENTS_DIR);
        if (agentsDepth > 5) {
            this.addValidationResult('directory_depth', 'warn', {
                message: `.agents directory structure is deep (${agentsDepth} levels)`,
                depth: agentsDepth,
                path: AGENTS_DIR
            });
        } else {
            this.addValidationResult('directory_depth', 'pass', {
                message: `.agents directory structure depth is acceptable`,
                depth: agentsDepth,
                path: AGENTS_DIR
            });
        }
    }

    addValidationResult(name, status, details) {
        this.validationResults.validations[name] = {
            status,
            timestamp: new Date().toISOString(),
            ...details
        };

        this.validationResults.summary.total_validations++;

        switch (status) {
            case 'pass':
                this.validationResults.summary.passed_validations++;
                this.log(`${name}: PASS - ${details.message}`, 'pass');
                break;
            case 'fail':
                this.validationResults.summary.failed_validations++;
                this.log(`${name}: FAIL - ${details.message}`, 'fail');
                break;
            case 'warn':
                this.validationResults.summary.warnings++;
                this.log(`${name}: WARN - ${details.message}`, 'warn');
                break;
            case 'critical':
                this.validationResults.summary.critical_issues++;
                this.criticalIssues.push({ name, ...details });
                this.log(`${name}: CRITICAL - ${details.message}`, 'critical');
                break;
        }
    }

    async runAdvancedValidation() {
        this.log('Starting advanced validation...', 'info');
        this.log(`Base directory: ${BASE_DIR}`, 'info');

        // Validate all skills
        this.log('Validating skills...', 'info');
        if (fs.existsSync(SKILLS_DIR)) {
            const skillDirs = fs.readdirSync(SKILLS_DIR).filter(item => {
                const itemPath = path.join(SKILLS_DIR, item);
                return fs.statSync(itemPath).isDirectory();
            });

            for (const skillDir of skillDirs) {
                const skillPath = path.join(SKILLS_DIR, skillDir);
                this.validateSkillFrontMatter(skillPath, skillDir);
                this.validateSkillContent(skillPath, skillDir);
            }
        }

        // Validate all workflows
        this.log('Validating workflows...', 'info');
        if (fs.existsSync(WORKFLOWS_DIR)) {
            const workflowFiles = fs.readdirSync(WORKFLOWS_DIR).filter(file => file.endsWith('.md'));
            
            for (const workflowFile of workflowFiles) {
                const workflowPath = path.join(WORKFLOWS_DIR, workflowFile);
                const workflowName = workflowFile.replace('.md', '');
                this.validateWorkflowStructure(workflowPath, workflowName);
            }
        }

        // Cross-reference validation
        this.validateCrossReferences();

        // Security compliance validation
        this.validateSecurityCompliance();

        // Performance metrics validation
        this.validatePerformanceMetrics();

        // Generate summary
        this.generateSummary();

        return this.validationResults;
    }

    generateSummary() {
        const { summary, critical_issues } = this.validationResults;
        
        this.log('=== Advanced Validation Summary ===', 'info');
        this.log(`Total validations: ${summary.total_validations}`, 'info');
        this.log(`Passed: ${summary.passed_validations}`, 'pass');
        this.log(`Failed: ${summary.failed_validations}`, summary.failed_validations > 0 ? 'fail' : 'info');
        this.log(`Warnings: ${summary.warnings}`, 'warn');
        this.log(`Critical issues: ${summary.critical_issues}`, 'critical');

        if (critical_issues.length > 0) {
            this.log('Critical Issues:', 'critical');
            critical_issues.forEach(issue => {
                this.log(`  - ${issue.name}: ${issue.message}`, 'critical');
            });
        }

        // Save validation results
        const validationReportPath = path.join(AGENTS_DIR, 'reports', 'advanced-validation.json');
        const reportsDir = path.dirname(validationReportPath);
        
        if (!fs.existsSync(reportsDir)) {
            fs.mkdirSync(reportsDir, { recursive: true });
        }

        fs.writeFileSync(validationReportPath, JSON.stringify(this.validationResults, null, 2));
        this.log(`Advanced validation report saved to: ${validationReportPath}`, 'info');
    }
}

// CLI interface
async function main() {
    const validator = new AdvancedValidator();
    
    try {
        const results = await validator.runAdvancedValidation();
        process.exit(results.summary.critical_issues > 0 ? 1 : 0);
    } catch (error) {
        console.error('Advanced validation failed:', error);
        process.exit(1);
    }
}

// Export for use in other modules
module.exports = { AdvancedValidator };

// Run if called directly
if (require.main === module) {
    main();
}
