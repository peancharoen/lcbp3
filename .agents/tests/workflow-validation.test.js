/**
 * workflow-validation.test.js - Integration tests for workflows
 * Part of LCBP3-DMS Phase 3 enhancements
 */

const fs = require('fs');
const path = require('path');

// Test configuration
const BASE_DIR = path.resolve(__dirname, '..');
const WORKFLOWS_DIR = path.join(BASE_DIR, '.windsurf', 'workflows');
const AGENTS_DIR = path.join(BASE_DIR, '.agents');

// Test utilities
class WorkflowTestSuite {
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

    testWorkflowFile(filePath, expectedName) {
        if (!fs.existsSync(filePath)) {
            this.assert(false, `Workflow file exists: ${expectedName}`);
            return false;
        }

        try {
            const content = fs.readFileSync(filePath, 'utf8');
            
            // Basic structure checks
            this.assert(content.length > 0, `${expectedName} has content`);
            this.assert(content.includes('#'), `${expectedName} has markdown headers`);
            
            // Check for workflow-specific patterns
            if (expectedName.includes('speckit-')) {
                this.assert(content.includes('speckit-'), `${expectedName} contains speckit reference`);
            }
            
            // Check for proper markdown formatting
            const lines = content.split('\n');
            const nonEmptyLines = lines.filter(line => line.trim().length > 0);
            this.assert(nonEmptyLines.length >= 5, `${expectedName} has sufficient content`);
            
            return true;
        } catch (error) {
            this.assert(false, `${expectedName} - error reading file: ${error.message}`);
            return false;
        }
    }

    validateWorkflowDependency(workflowName, workflowContent) {
        // Check if workflow references existing skills
        const skillReferences = workflowContent.match(/@speckit-\w+/g) || [];
        const skillsDir = path.join(AGENTS_DIR, 'skills');
        
        for (const skillRef of skillReferences) {
            const skillName = skillRef.replace('@', '');
            const skillPath = path.join(skillsDir, skillName);
            
            if (!fs.existsSync(skillPath)) {
                this.assert(false, `${workflowName} references non-existent skill: ${skillRef}`);
                return false;
            }
        }
        
        return true;
    }
}

// Expected workflows mapping
const expectedWorkflows = {
    '00-speckit.all.md': 'Full pipeline workflow',
    '01-speckit.constitution.md': 'Constitution workflow',
    '02-speckit.specify.md': 'Specification workflow',
    '03-speckit.clarify.md': 'Clarification workflow',
    '04-speckit.plan.md': 'Planning workflow',
    '05-speckit.tasks.md': 'Task breakdown workflow',
    '06-speckit.analyze.md': 'Analysis workflow',
    '07-speckit.implement.md': 'Implementation workflow',
    '08-speckit.checker.md': 'Static analysis workflow',
    '09-speckit.tester.md': 'Testing workflow',
    '10-speckit.reviewer.md': 'Code review workflow',
    '11-speckit.validate.md': 'Validation workflow',
    'speckit.prepare.md': 'Preparation workflow',
    'schema-change.md': 'Schema change workflow',
    'create-backend-module.md': 'Backend module creation',
    'create-frontend-page.md': 'Frontend page creation',
    'deploy.md': 'Deployment workflow',
    'review.md': 'Code review workflow',
    'util-speckit.checklist.md': 'Checklist utility',
    'util-speckit.diff.md': 'Diff utility',
    'util-speckit.migrate.md': 'Migration utility',
    'util-speckit.quizme.md': 'Quiz utility',
    'util-speckit.status.md': 'Status utility',
    'util-speckit.taskstoissues.md': 'Task to issues utility'
};

// Test suite implementation
const workflowTestSuite = new WorkflowTestSuite();

function runWorkflowTests() {
    workflowTestSuite.log('=== Workflow Validation Test Suite ===', 'info');
    workflowTestSuite.log(`Workflows directory: ${WORKFLOWS_DIR}`, 'info');
    workflowTestSuite.log(`Started: ${new Date().toISOString()}`, 'info');
    workflowTestSuite.log('');

    // Test 1: Workflows directory exists
    workflowTestSuite.log('Test 1: Directory Structure', 'info');
    workflowTestSuite.assert(fs.existsSync(WORKFLOWS_DIR), 'Workflows directory exists');
    workflowTestSuite.log('');

    // Test 2: Expected workflow files exist
    workflowTestSuite.log('Test 2: Expected Workflow Files', 'info');
    let foundWorkflows = 0;
    
    for (const [filename, description] of Object.entries(expectedWorkflows)) {
        const filePath = path.join(WORKFLOWS_DIR, filename);
        workflowTestSuite.testWorkflowFile(filePath, description);
        if (fs.existsSync(filePath)) {
            foundWorkflows++;
        }
    }
    
    workflowTestSuite.assert(foundWorkflows >= 20, `Found at least 20 workflows (found ${foundWorkflows})`);
    workflowTestSuite.log('');

    // Test 3: Workflow content validation
    workflowTestSuite.log('Test 3: Content Validation', 'info');
    
    for (const [filename, description] of Object.entries(expectedWorkflows)) {
        const filePath = path.join(WORKFLOWS_DIR, filename);
        
        if (fs.existsSync(filePath)) {
            try {
                const content = fs.readFileSync(filePath, 'utf8');
                
                // Check for proper workflow structure
                workflowTestSuite.assert(content.includes('#'), `${filename} has markdown headers`);
                workflowTestSuite.assert(content.length > 100, `${filename} has substantial content`);
                
                // Validate skill dependencies
                workflowTestSuite.validateWorkflowDependency(filename, content);
                
            } catch (error) {
                workflowTestSuite.assert(false, `${filename} - content validation error: ${error.message}`);
            }
        }
    }
    workflowTestSuite.log('');

    // Test 4: Workflow naming consistency
    workflowTestSuite.log('Test 4: Naming Consistency', 'info');
    const actualFiles = fs.readdirSync(WORKFLOWS_DIR).filter(file => file.endsWith('.md'));
    
    for (const actualFile of actualFiles) {
        if (!expectedWorkflows[actualFile]) {
            workflowTestSuite.log(`  UNEXPECTED: ${actualFile} not in expected list`, 'warn');
        }
    }
    
    for (const expectedFile of Object.keys(expectedWorkflows)) {
        if (!actualFiles.includes(expectedFile)) {
            workflowTestSuite.assert(false, `Missing expected workflow: ${expectedFile}`);
        }
    }
    workflowTestSuite.log('');

    // Test 5: Cross-reference validation
    workflowTestSuite.log('Test 5: Cross-Reference Validation', 'info');
    
    // Check if README.md references workflows correctly
    const readmePath = path.join(AGENTS_DIR, 'README.md');
    if (fs.existsSync(readmePath)) {
        const readmeContent = fs.readFileSync(readmePath, 'utf8');
        workflowTestSuite.assert(
            readmeContent.includes('.windsurf/workflows'), 
            'README.md references correct workflows path'
        );
    }
    workflowTestSuite.log('');

    // Results Summary
    workflowTestSuite.log('=== Workflow Test Results Summary ===', 'info');
    workflowTestSuite.log(`Passed: ${workflowTestSuite.results.passed}`, 'pass');
    workflowTestSuite.log(`Failed: ${workflowTestSuite.results.failed}`, workflowTestSuite.results.failed > 0 ? 'fail' : 'pass');
    
    if (workflowTestSuite.results.errors.length > 0) {
        workflowTestSuite.log('Errors:', 'fail');
        workflowTestSuite.results.errors.forEach(error => {
            workflowTestSuite.log(`  - ${error}`, 'fail');
        });
    }
    
    workflowTestSuite.log(`Completed: ${new Date().toISOString()}`, 'info');
    
    return workflowTestSuite.results.failed === 0;
}

// Export for use in other modules
module.exports = { WorkflowTestSuite, runWorkflowTests };

// Run tests if called directly
if (require.main === module) {
    const success = runWorkflowTests();
    process.exit(success ? 0 : 1);
}
