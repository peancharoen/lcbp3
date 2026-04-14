/**
 * skill-integration.test.js - Integration tests for .agents skills
 * Part of LCBP3-DMS Phase 3 enhancements
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Test configuration
const BASE_DIR = path.resolve(__dirname, '..');
const AGENTS_DIR = path.join(BASE_DIR, '.agents');
const SKILLS_DIR = path.join(AGENTS_DIR, 'skills');
const WORKFLOWS_DIR = path.join(BASE_DIR, '.windsurf', 'workflows');

// Test utilities
class SkillTestSuite {
    constructor() {
        this.results = {
            passed: 0,
            failed: 0,
            errors: []
        };
    }

    log(message, type = 'info') {
        const colors = {
            info: '\x1b[36m',    // Cyan
            pass: '\x1b[32m',    // Green
            fail: '\x1b[31m',    // Red
            warn: '\x1b[33m',    // Yellow
            reset: '\x1b[0m'
        };
        
        const color = colors[type] || colors.info;
        console.log(`${color}${message}${colors.reset}`);
    }

    assert(condition, message) {
        if (condition) {
            this.log(`  PASS: ${message}`, 'pass');
            this.results.passed++;
            return true;
        } else {
            this.log(`  FAIL: ${message}`, 'fail');
            this.results.failed++;
            this.results.errors.push(message);
            return false;
        }
    }

    testDirectoryExists(dirPath, description) {
        const exists = fs.existsSync(dirPath);
        this.assert(exists, `${description} exists at ${dirPath}`);
        return exists;
    }

    testFileExists(filePath, description) {
        const exists = fs.existsSync(filePath);
        this.assert(exists, `${description} exists at ${filePath}`);
        return exists;
    }

    testFileContent(filePath, pattern, description) {
        if (!fs.existsSync(filePath)) {
            this.assert(false, `${description} - file not found: ${filePath}`);
            return false;
        }
        
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            const matches = content.match(pattern);
            this.assert(matches !== null, `${description} - pattern found in ${filePath}`);
            return matches !== null;
        } catch (error) {
            this.assert(false, `${description} - error reading file: ${error.message}`);
            return false;
        }
    }

    runScript(scriptPath, description) {
        try {
            const output = execSync(scriptPath, { encoding: 'utf8', cwd: BASE_DIR });
            this.log(`  SCRIPT: ${description} executed successfully`, 'pass');
            return { success: true, output };
        } catch (error) {
            this.log(`  SCRIPT: ${description} failed - ${error.message}`, 'fail');
            this.results.failed++;
            this.results.errors.push(`${description}: ${error.message}`);
            return { success: false, error: error.message };
        }
    }
}

// Test suite implementation
const testSuite = new SkillTestSuite();

function runAllTests() {
    testSuite.log('=== .agents Integration Test Suite ===', 'info');
    testSuite.log(`Base directory: ${BASE_DIR}`, 'info');
    testSuite.log(`Started: ${new Date().toISOString()}`, 'info');
    testSuite.log('');

    // Test 1: Directory Structure
    testSuite.log('Test 1: Directory Structure', 'info');
    testSuite.testDirectoryExists(AGENTS_DIR, '.agents directory');
    testSuite.testDirectoryExists(SKILLS_DIR, 'skills directory');
    testSuite.testDirectoryExists(WORKFLOWS_DIR, 'workflows directory');
    testSuite.testDirectoryExists(path.join(AGENTS_DIR, 'scripts'), 'scripts directory');
    testSuite.testDirectoryExists(path.join(AGENTS_DIR, 'rules'), 'rules directory');
    testSuite.log('');

    // Test 2: Core Files
    testSuite.log('Test 2: Core Files', 'info');
    testSuite.testFileExists(path.join(AGENTS_DIR, 'README.md'), 'README.md');
    testSuite.testFileExists(path.join(SKILLS_DIR, 'VERSION'), 'skills VERSION file');
    testSuite.testFileExists(path.join(SKILLS_DIR, 'skills.md'), 'skills.md documentation');
    testSuite.log('');

    // Test 3: Script Files
    testSuite.log('Test 3: Validation Scripts', 'info');
    testSuite.testFileExists(path.join(AGENTS_DIR, 'scripts', 'bash', 'validate-versions.sh'), 'bash validate-versions.sh');
    testSuite.testFileExists(path.join(AGENTS_DIR, 'scripts', 'bash', 'audit-skills.sh'), 'bash audit-skills.sh');
    testSuite.testFileExists(path.join(AGENTS_DIR, 'scripts', 'bash', 'sync-workflows.sh'), 'bash sync-workflows.sh');
    testSuite.testFileExists(path.join(AGENTS_DIR, 'scripts', 'powershell', 'validate-versions.ps1'), 'powershell validate-versions.ps1');
    testSuite.testFileExists(path.join(AGENTS_DIR, 'scripts', 'powershell', 'audit-skills.ps1'), 'powershell audit-skills.ps1');
    testSuite.log('');

    // Test 4: Version Consistency
    testSuite.log('Test 4: Version Consistency', 'info');
    testSuite.testFileContent(path.join(AGENTS_DIR, 'README.md'), /v1\.8\.6/, 'README.md version');
    testSuite.testFileContent(path.join(SKILLS_DIR, 'VERSION'), /version: 1\.8\.6/, 'skills VERSION file');
    testSuite.testFileContent(path.join(SKILLS_DIR, 'skills.md'), /v1\.8\.6/, 'skills.md version');
    testSuite.testFileContent(path.join(AGENTS_DIR, 'rules', '00-project-context.md'), /v1\.8\.6/, 'project context version');
    testSuite.log('');

    // Test 5: Skills Structure
    testSuite.log('Test 5: Skills Structure', 'info');
    const skillDirs = fs.readdirSync(SKILLS_DIR).filter(item => {
        const itemPath = path.join(SKILLS_DIR, item);
        return fs.statSync(itemPath).isDirectory() && item.startsWith('speckit-') || item === 'nestjs-best-practices' || item === 'next-best-practices';
    });

    testSuite.assert(skillDirs.length >= 20, `Found at least 20 skill directories (found ${skillDirs.length})`);
    
    // Test a few key skills
    const keySkills = ['speckit-plan', 'speckit-implement', 'speckit-specify', 'speckit-validate'];
    keySkills.forEach(skill => {
        const skillPath = path.join(SKILLS_DIR, skill);
        const skillMdPath = path.join(skillPath, 'SKILL.md');
        testSuite.testDirectoryExists(skillPath, `${skill} directory`);
        testSuite.testFileExists(skillMdPath, `${skill} SKILL.md`);
        
        if (fs.existsSync(skillMdPath)) {
            testSuite.testFileContent(skillMdPath, /^name:/, `${skill} has name field`);
            testSuite.testFileContent(skillMdPath, /^description:/, `${skill} has description field`);
            testSuite.testFileContent(skillMdPath, /^version:/, `${skill} has version field`);
            testSuite.testFileContent(skillMdPath, /^## Role$/, `${skill} has Role section`);
            testSuite.testFileContent(skillMdPath, /^## Task$/, `${skill} has Task section`);
        }
    });
    testSuite.log('');

    // Test 6: Workflows Structure
    testSuite.log('Test 6: Workflows Structure', 'info');
    const workflowFiles = fs.readdirSync(WORKFLOWS_DIR).filter(item => item.endsWith('.md'));
    testSuite.assert(workflowFiles.length >= 20, `Found at least 20 workflow files (found ${workflowFiles.length})`);
    
    // Test key workflows
    const keyWorkflows = ['00-speckit.all.md', '02-speckit.specify.md', '04-speckit.plan.md', '07-speckit.implement.md'];
    keyWorkflows.forEach(workflow => {
        const workflowPath = path.join(WORKFLOWS_DIR, workflow);
        testSuite.testFileExists(workflowPath, `${workflow} file`);
    });
    testSuite.log('');

    // Test 7: Rules Structure
    testSuite.log('Test 7: Rules Structure', 'info');
    const rulesDir = path.join(AGENTS_DIR, 'rules');
    const ruleFiles = fs.readdirSync(rulesDir).filter(item => item.endsWith('.md'));
    testSuite.assert(ruleFiles.length >= 10, `Found at least 10 rule files (found ${ruleFiles.length})`);
    
    // Test key rules
    const keyRules = ['00-project-context.md', '01-adr-019-uuid.md', '02-security.md'];
    keyRules.forEach(rule => {
        const rulePath = path.join(rulesDir, rule);
        testSuite.testFileExists(rulePath, `${rule} file`);
    });
    testSuite.log('');

    // Test 8: Script Execution (if on Unix-like system)
    if (process.platform !== 'win32') {
        testSuite.log('Test 8: Script Execution', 'info');
        
        // Test version validation script
        const versionScript = path.join(AGENTS_DIR, 'scripts', 'bash', 'validate-versions.sh');
        if (fs.existsSync(versionScript)) {
            try {
                // Make executable
                fs.chmodSync(versionScript, '755');
                testSuite.runScript(versionScript, 'Version validation script');
            } catch (error) {
                testSuite.log(`  SKIP: Cannot execute version script - ${error.message}`, 'warn');
            }
        }
        
        testSuite.log('');
    }

    // Test 9: Documentation Quality
    testSuite.log('Test 9: Documentation Quality', 'info');
    testSuite.testFileContent(path.join(AGENTS_DIR, 'README.md'), /## Troubleshooting/, 'README.md has troubleshooting section');
    testSuite.testFileContent(path.join(SKILLS_DIR, 'skills.md'), /## Skill Dependency Matrix/, 'skills.md has dependency matrix');
    testSuite.testFileContent(path.join(AGENTS_DIR, 'README.md'), /## Architecture/, 'README.md has architecture section');
    testSuite.log('');

    // Results Summary
    testSuite.log('=== Test Results Summary ===', 'info');
    testSuite.log(`Passed: ${testSuite.results.passed}`, 'pass');
    testSuite.log(`Failed: ${testSuite.results.failed}`, testSuite.results.failed > 0 ? 'fail' : 'pass');
    
    if (testSuite.results.errors.length > 0) {
        testSuite.log('Errors:', 'fail');
        testSuite.results.errors.forEach(error => {
            testSuite.log(`  - ${error}`, 'fail');
        });
    }
    
    testSuite.log(`Completed: ${new Date().toISOString()}`, 'info');
    
    return testSuite.results.failed === 0;
}

// Export for use in other modules
module.exports = { SkillTestSuite, runAllTests };

// Run tests if called directly
if (require.main === module) {
    const success = runAllTests();
    process.exit(success ? 0 : 1);
}
