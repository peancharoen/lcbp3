#!/usr/bin/env node

/**
 * health-monitor.js - Automated health monitoring system for .agents
 * Part of LCBP3-DMS Phase 3 enhancements
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const BASE_DIR = path.resolve(__dirname, '../..');
const AGENTS_DIR = path.join(BASE_DIR, '.agents');
const HEALTH_LOG_PATH = path.join(AGENTS_DIR, 'logs', 'health.log');
const HEALTH_REPORT_PATH = path.join(AGENTS_DIR, 'reports', 'health-report.json');

// Ensure directories exist
[ path.dirname(HEALTH_LOG_PATH), path.dirname(HEALTH_REPORT_PATH) ].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// Health monitoring class
class HealthMonitor {
    constructor() {
        this.startTime = new Date();
        this.metrics = {
            timestamp: this.startTime.toISOString(),
            version: '1.8.6',
            checks: {},
            summary: {
                total_checks: 0,
                passed_checks: 0,
                failed_checks: 0,
                warnings: 0,
                overall_health: 'unknown'
            }
        };
    }

    log(message, level = 'info') {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;
        
        // Console output with colors
        const colors = {
            info: '\x1b[36m',    // Cyan
            pass: '\x1b[32m',    // Green
            fail: '\x1b[31m',    // Red
            warn: '\x1b[33m',    // Yellow
            reset: '\x1b[0m'
        };
        
        const color = colors[level] || colors.info;
        console.log(`${color}${logEntry.trim()}${colors.reset}`);
        
        // File logging
        fs.appendFileSync(HEALTH_LOG_PATH, logEntry);
    }

    checkDirectoryExists(dirPath, checkName) {
        this.metrics.summary.total_checks++;
        const exists = fs.existsSync(dirPath);
        
        this.metrics.checks[checkName] = {
            type: 'directory_exists',
            status: exists ? 'pass' : 'fail',
            path: dirPath,
            message: exists ? 'Directory exists' : 'Directory missing'
        };
        
        if (exists) {
            this.metrics.summary.passed_checks++;
            this.log(`${checkName}: PASS - Directory exists`, 'pass');
        } else {
            this.metrics.summary.failed_checks++;
            this.log(`${checkName}: FAIL - Directory missing: ${dirPath}`, 'fail');
        }
        
        return exists;
    }

    checkFileExists(filePath, checkName) {
        this.metrics.summary.total_checks++;
        const exists = fs.existsSync(filePath);
        
        this.metrics.checks[checkName] = {
            type: 'file_exists',
            status: exists ? 'pass' : 'fail',
            path: filePath,
            message: exists ? 'File exists' : 'File missing'
        };
        
        if (exists) {
            this.metrics.summary.passed_checks++;
            this.log(`${checkName}: PASS - File exists`, 'pass');
        } else {
            this.metrics.summary.failed_checks++;
            this.log(`${checkName}: FAIL - File missing: ${filePath}`, 'fail');
        }
        
        return exists;
    }

    checkFileVersion(filePath, expectedVersion, checkName) {
        this.metrics.summary.total_checks++;
        
        if (!fs.existsSync(filePath)) {
            this.metrics.summary.failed_checks++;
            this.metrics.checks[checkName] = {
                type: 'version_check',
                status: 'fail',
                path: filePath,
                message: 'File does not exist'
            };
            this.log(`${checkName}: FAIL - File not found: ${filePath}`, 'fail');
            return false;
        }
        
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            const versionMatch = content.match(/v?(\d+\.\d+\.\d+)/);
            const actualVersion = versionMatch ? versionMatch[1] : 'not_found';
            const versionMatches = actualVersion === expectedVersion;
            
            this.metrics.checks[checkName] = {
                type: 'version_check',
                status: versionMatches ? 'pass' : 'fail',
                path: filePath,
                expected_version: expectedVersion,
                actual_version: actualVersion,
                message: versionMatches ? 'Version matches' : `Version mismatch (expected ${expectedVersion}, found ${actualVersion})`
            };
            
            if (versionMatches) {
                this.metrics.summary.passed_checks++;
                this.log(`${checkName}: PASS - Version ${actualVersion}`, 'pass');
            } else {
                this.metrics.summary.failed_checks++;
                this.log(`${checkName}: FAIL - Version mismatch (expected ${expectedVersion}, found ${actualVersion})`, 'fail');
            }
            
            return versionMatches;
        } catch (error) {
            this.metrics.summary.failed_checks++;
            this.metrics.checks[checkName] = {
                type: 'version_check',
                status: 'fail',
                path: filePath,
                message: `Error reading file: ${error.message}`
            };
            this.log(`${checkName}: FAIL - Error reading file: ${error.message}`, 'fail');
            return false;
        }
    }

    checkSkillHealth() {
        this.log('Checking skill health...', 'info');
        const skillsDir = path.join(AGENTS_DIR, 'skills');
        
        if (!fs.existsSync(skillsDir)) {
            this.log('Skills directory not found', 'fail');
            return;
        }
        
        const skillDirs = fs.readdirSync(skillsDir).filter(item => {
            const itemPath = path.join(skillsDir, item);
            return fs.statSync(itemPath).isDirectory();
        });
        
        this.metrics.checks['skill_count'] = {
            type: 'skill_count',
            status: skillDirs.length >= 20 ? 'pass' : 'warn',
            count: skillDirs.length,
            expected: 20,
            message: `Found ${skillDirs.length} skills (expected at least 20)`
        };
        
        if (skillDirs.length >= 20) {
            this.metrics.summary.passed_checks++;
            this.log(`Skill count: PASS - Found ${skillDirs.length} skills`, 'pass');
        } else {
            this.metrics.summary.warnings++;
            this.log(`Skill count: WARN - Only ${skillDirs.length} skills found (expected at least 20)`, 'warn');
        }
        
        // Check individual skills
        let healthySkills = 0;
        skillDirs.forEach(skillDir => {
            const skillPath = path.join(skillsDir, skillDir);
            const skillMdPath = path.join(skillPath, 'SKILL.md');
            
            if (fs.existsSync(skillMdPath)) {
                try {
                    const content = fs.readFileSync(skillMdPath, 'utf8');
                    const hasName = content.includes('name:');
                    const hasDescription = content.includes('description:');
                    const hasVersion = content.includes('version:');
                    const hasRole = content.includes('## Role');
                    const hasTask = content.includes('## Task');
                    
                    const isHealthy = hasName && hasDescription && hasVersion && hasRole && hasTask;
                    if (isHealthy) healthySkills++;
                    
                    this.metrics.checks[`skill_${skillDir}_health`] = {
                        type: 'skill_health',
                        status: isHealthy ? 'pass' : 'fail',
                        skill: skillDir,
                        has_name: hasName,
                        has_description: hasDescription,
                        has_version: hasVersion,
                        has_role: hasRole,
                        has_task: hasTask,
                        message: isHealthy ? 'Skill is healthy' : 'Skill has missing sections'
                    };
                } catch (error) {
                    this.metrics.checks[`skill_${skillDir}_health`] = {
                        type: 'skill_health',
                        status: 'fail',
                        skill: skillDir,
                        message: `Error reading skill: ${error.message}`
                    };
                }
            }
        });
        
        this.metrics.summary.total_checks++;
        if (healthySkills === skillDirs.length) {
            this.metrics.summary.passed_checks++;
            this.log(`Individual skills: PASS - All ${healthySkills} skills are healthy`, 'pass');
        } else {
            this.metrics.summary.failed_checks++;
            this.log(`Individual skills: FAIL - Only ${healthySkills}/${skillDirs.length} skills are healthy`, 'fail');
        }
    }

    checkWorkflowHealth() {
        this.log('Checking workflow health...', 'info');
        const workflowsDir = path.join(BASE_DIR, '.windsurf', 'workflows');
        
        if (!fs.existsSync(workflowsDir)) {
            this.log('Workflows directory not found', 'fail');
            return;
        }
        
        const workflowFiles = fs.readdirSync(workflowsDir).filter(file => file.endsWith('.md'));
        
        this.metrics.checks['workflow_count'] = {
            type: 'workflow_count',
            status: workflowFiles.length >= 20 ? 'pass' : 'warn',
            count: workflowFiles.length,
            expected: 20,
            message: `Found ${workflowFiles.length} workflows (expected at least 20)`
        };
        
        if (workflowFiles.length >= 20) {
            this.metrics.summary.passed_checks++;
            this.log(`Workflow count: PASS - Found ${workflowFiles.length} workflows`, 'pass');
        } else {
            this.metrics.summary.warnings++;
            this.log(`Workflow count: WARN - Only ${workflowFiles.length} workflows found (expected at least 20)`, 'warn');
        }
    }

    calculateOverallHealth() {
        const { total_checks, passed_checks, failed_checks, warnings } = this.metrics.summary;
        
        if (failed_checks === 0) {
            this.metrics.summary.overall_health = warnings === 0 ? 'excellent' : 'good';
        } else if (failed_checks <= total_checks * 0.1) {
            this.metrics.summary.overall_health = 'fair';
        } else {
            this.metrics.summary.overall_health = 'poor';
        }
        
        this.log(`Overall health: ${this.metrics.summary.overall_health}`, 'info');
    }

    generateReport() {
        const report = {
            ...this.metrics,
            duration: new Date() - this.startTime,
            environment: {
                node_version: process.version,
                platform: process.platform,
                agents_dir: AGENTS_DIR
            }
        };
        
        fs.writeFileSync(HEALTH_REPORT_PATH, JSON.stringify(report, null, 2));
        this.log(`Health report saved to: ${HEALTH_REPORT_PATH}`, 'info');
        
        return report;
    }

    async runFullHealthCheck() {
        this.log('Starting comprehensive health check...', 'info');
        this.log(`Base directory: ${BASE_DIR}`, 'info');
        
        // Core directory checks
        this.checkDirectoryExists(AGENTS_DIR, 'agents_directory');
        this.checkDirectoryExists(path.join(AGENTS_DIR, 'skills'), 'skills_directory');
        this.checkDirectoryExists(path.join(AGENTS_DIR, 'scripts'), 'scripts_directory');
        this.checkDirectoryExists(path.join(AGENTS_DIR, 'rules'), 'rules_directory');
        this.checkDirectoryExists(path.join(BASE_DIR, '.windsurf', 'workflows'), 'workflows_directory');
        
        // Core file checks
        this.checkFileExists(path.join(AGENTS_DIR, 'README.md'), 'readme_file');
        this.checkFileExists(path.join(AGENTS_DIR, 'skills', 'VERSION'), 'skills_version_file');
        this.checkFileExists(path.join(AGENTS_DIR, 'skills', 'skills.md'), 'skills_documentation');
        
        // Version consistency checks
        this.checkFileVersion(path.join(AGENTS_DIR, 'README.md'), '1.8.6', 'readme_version');
        this.checkFileVersion(path.join(AGENTS_DIR, 'skills', 'VERSION'), '1.8.6', 'skills_version_file_version');
        this.checkFileVersion(path.join(AGENTS_DIR, 'skills', 'skills.md'), '1.8.6', 'skills_documentation_version');
        this.checkFileVersion(path.join(AGENTS_DIR, 'rules', '00-project-context.md'), '1.8.6', 'project_context_version');
        
        // Script availability checks
        this.checkFileExists(path.join(AGENTS_DIR, 'scripts', 'bash', 'validate-versions.sh'), 'bash_version_script');
        this.checkFileExists(path.join(AGENTS_DIR, 'scripts', 'bash', 'audit-skills.sh'), 'bash_audit_script');
        this.checkFileExists(path.join(AGENTS_DIR, 'scripts', 'bash', 'sync-workflows.sh'), 'bash_sync_script');
        this.checkFileExists(path.join(AGENTS_DIR, 'scripts', 'powershell', 'validate-versions.ps1'), 'powershell_version_script');
        this.checkFileExists(path.join(AGENTS_DIR, 'scripts', 'powershell', 'audit-skills.ps1'), 'powershell_audit_script');
        
        // Detailed health checks
        this.checkSkillHealth();
        this.checkWorkflowHealth();
        
        // Calculate overall health
        this.calculateOverallHealth();
        
        // Generate report
        const report = this.generateReport();
        
        // Summary
        this.log('=== Health Check Summary ===', 'info');
        this.log(`Total checks: ${this.metrics.summary.total_checks}`, 'info');
        this.log(`Passed: ${this.metrics.summary.passed_checks}`, 'pass');
        this.log(`Failed: ${this.metrics.summary.failed_checks}`, this.metrics.summary.failed_checks > 0 ? 'fail' : 'info');
        this.log(`Warnings: ${this.metrics.summary.warnings}`, 'warn');
        this.log(`Overall health: ${this.metrics.summary.overall_health}`, 'info');
        this.log(`Duration: ${new Date() - this.startTime}ms`, 'info');
        
        return report;
    }
}

// CLI interface
async function main() {
    const monitor = new HealthMonitor();
    
    try {
        const report = await monitor.runFullHealthCheck();
        process.exit(report.summary.failed_checks > 0 ? 1 : 0);
    } catch (error) {
        console.error('Health check failed:', error);
        process.exit(1);
    }
}

// Export for use in other modules
module.exports = { HealthMonitor };

// Run if called directly
if (require.main === module) {
    main();
}
