#!/usr/bin/env node

/**
 * performance-monitor.js - Performance monitoring for .agents skills
 * Part of LCBP3-DMS Phase 3 enhancements
 */

const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

// Configuration
const BASE_DIR = path.resolve(__dirname, '../..');
const AGENTS_DIR = path.join(BASE_DIR, '.agents');
const SKILLS_DIR = path.join(AGENTS_DIR, 'skills');
const PERFORMANCE_LOG_PATH = path.join(AGENTS_DIR, 'logs', 'performance.log');
const PERFORMANCE_REPORT_PATH = path.join(AGENTS_DIR, 'reports', 'performance-report.json');

// Ensure directories exist
[ path.dirname(PERFORMANCE_LOG_PATH), path.dirname(PERFORMANCE_REPORT_PATH) ].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// Performance monitoring class
class PerformanceMonitor {
    constructor() {
        this.startTime = performance.now();
        this.metrics = {
            timestamp: new Date().toISOString(),
            duration: 0,
            skill_metrics: {},
            workflow_metrics: {},
            system_metrics: {},
            summary: {
                total_skills_analyzed: 0,
                total_workflows_analyzed: 0,
                average_skill_size: 0,
                average_workflow_size: 0,
                performance_score: 0,
                recommendations: []
            }
        };
    }

    log(message, level = 'info') {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;
        
        // Console output with colors
        const colors = {
            info: '\x1b[36m',    // Cyan
            good: '\x1b[32m',    // Green
            warn: '\x1b[33m',    // Yellow
            poor: '\x1b[31m',    // Red
            reset: '\x1b[0m'
        };
        
        const color = colors[level] || colors.info;
        console.log(`${color}${logEntry.trim()}${colors.reset}`);
        
        // File logging
        fs.appendFileSync(PERFORMANCE_LOG_PATH, logEntry);
    }

    analyzeSkillPerformance(skillPath, skillName) {
        const skillMdPath = path.join(skillPath, 'SKILL.md');
        
        if (!fs.existsSync(skillMdPath)) {
            this.log(`Skipping ${skillName} - SKILL.md not found`, 'warn');
            return null;
        }

        const startTime = performance.now();
        
        try {
            const stats = fs.statSync(skillMdPath);
            const content = fs.readFileSync(skillMdPath, 'utf8');
            
            // Basic metrics
            const fileSizeKB = stats.size / 1024;
            const lineCount = content.split('\n').length;
            const wordCount = content.split(/\s+/).filter(word => word.length > 0).length;
            const charCount = content.length;
            
            // Content complexity metrics
            const sectionCount = (content.match(/^#+\s/gm) || []).length;
            const codeBlockCount = (content.match(/```[\s\S]*?```/g) || []).length;
            const listCount = (content.match(/^[-*+]\s/gm) || []).length;
            
            // Front matter analysis
            const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
            const frontMatterSize = frontMatterMatch ? frontMatterMatch[1].length : 0;
            const hasFrontMatter = frontMatterMatch !== null;
            
            // Readability metrics
            const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
            const avgWordsPerSentence = sentences.length > 0 ? wordCount / sentences.length : 0;
            const avgCharsPerWord = wordCount > 0 ? charCount / wordCount : 0;
            
            // Performance score calculation
            let performanceScore = 100;
            
            // Size penalties
            if (fileSizeKB > 50) performanceScore -= 10;
            if (fileSizeKB > 100) performanceScore -= 20;
            
            // Content quality bonuses
            if (hasFrontMatter) performanceScore += 5;
            if (sectionCount >= 3) performanceScore += 5;
            if (codeBlockCount > 0) performanceScore += 5;
            
            // Readability penalties
            if (avgWordsPerSentence > 25) performanceScore -= 5;
            if (avgWordsPerSentence > 35) performanceScore -= 10;
            
            const analysisTime = performance.now() - startTime;
            
            const skillMetrics = {
                skill_name: skillName,
                file_path: skillMdPath,
                file_size_kb: Math.round(fileSizeKB * 100) / 100,
                line_count: lineCount,
                word_count: wordCount,
                char_count: charCount,
                section_count: sectionCount,
                code_block_count: codeBlockCount,
                list_count: listCount,
                front_matter_size: frontMatterSize,
                has_front_matter: hasFrontMatter,
                avg_words_per_sentence: Math.round(avgWordsPerSentence * 100) / 100,
                avg_chars_per_word: Math.round(avgCharsPerWord * 100) / 100,
                performance_score: Math.max(0, Math.min(100, performanceScore)),
                analysis_time_ms: Math.round(analysisTime * 100) / 100,
                last_modified: stats.mtime.toISOString()
            };

            this.metrics.skill_metrics[skillName] = skillMetrics;
            
            // Log performance assessment
            if (performanceScore >= 80) {
                this.log(`${skillName}: GOOD performance (score: ${performanceScore})`, 'good');
            } else if (performanceScore >= 60) {
                this.log(`${skillName}: OK performance (score: ${performanceScore})`, 'info');
            } else {
                this.log(`${skillName}: POOR performance (score: ${performanceScore})`, 'poor');
            }

            return skillMetrics;

        } catch (error) {
            this.log(`Error analyzing ${skillName}: ${error.message}`, 'warn');
            return null;
        }
    }

    analyzeWorkflowPerformance(workflowPath, workflowName) {
        const startTime = performance.now();
        
        if (!fs.existsSync(workflowPath)) {
            this.log(`Skipping workflow ${workflowName} - file not found`, 'warn');
            return null;
        }

        try {
            const stats = fs.statSync(workflowPath);
            const content = fs.readFileSync(workflowPath, 'utf8');
            
            // Basic metrics
            const fileSizeKB = stats.size / 1024;
            const lineCount = content.split('\n').length;
            const wordCount = content.split(/\s+/).filter(word => word.length > 0).length;
            
            // Workflow-specific metrics
            const stepCount = (content.match(/^\d+\./gm) || []).length;
            const codeBlockCount = (content.match(/```[\s\S]*?```/g) || []).length;
            const skillReferences = (content.match(/@speckit-\w+/g) || []).length;
            
            // Performance score calculation
            let performanceScore = 100;
            
            // Size penalties
            if (fileSizeKB > 20) performanceScore -= 10;
            if (fileSizeKB > 50) performanceScore -= 20;
            
            // Content quality bonuses
            if (stepCount > 0) performanceScore += 10;
            if (codeBlockCount > 0) performanceScore += 5;
            if (skillReferences > 0) performanceScore += 5;
            
            const analysisTime = performance.now() - startTime;
            
            const workflowMetrics = {
                workflow_name: workflowName,
                file_path: workflowPath,
                file_size_kb: Math.round(fileSizeKB * 100) / 100,
                line_count: lineCount,
                word_count: wordCount,
                step_count: stepCount,
                code_block_count: codeBlockCount,
                skill_references: skillReferences,
                performance_score: Math.max(0, Math.min(100, performanceScore)),
                analysis_time_ms: Math.round(analysisTime * 100) / 100,
                last_modified: stats.mtime.toISOString()
            };

            this.metrics.workflow_metrics[workflowName] = workflowMetrics;
            
            // Log performance assessment
            if (performanceScore >= 80) {
                this.log(`${workflowName}: GOOD performance (score: ${performanceScore})`, 'good');
            } else if (performanceScore >= 60) {
                this.log(`${workflowName}: OK performance (score: ${performanceScore})`, 'info');
            } else {
                this.log(`${workflowName}: POOR performance (score: ${performanceScore})`, 'poor');
            }

            return workflowMetrics;

        } catch (error) {
            this.log(`Error analyzing workflow ${workflowName}: ${error.message}`, 'warn');
            return null;
        }
    }

    analyzeSystemMetrics() {
        this.log('Analyzing system metrics...', 'info');
        
        // Directory sizes
        const agentsSize = this.getDirectorySize(AGENTS_DIR);
        const skillsSize = this.getDirectorySize(SKILLS_DIR);
        const workflowsDir = path.join(BASE_DIR, '.windsurf', 'workflows');
        const workflowsSize = fs.existsSync(workflowsDir) ? this.getDirectorySize(workflowsDir) : 0;
        
        // File counts
        const totalFiles = this.countFiles(AGENTS_DIR);
        const skillFiles = this.countFiles(SKILLS_DIR);
        const workflowFiles = fs.existsSync(workflowsDir) ? this.countFiles(workflowsDir) : 0;
        
        this.metrics.system_metrics = {
            agents_directory_size_kb: Math.round(agentsSize / 1024),
            skills_directory_size_kb: Math.round(skillsSize / 1024),
            workflows_directory_size_kb: Math.round(workflowsSize / 1024),
            total_files: totalFiles,
            skill_files: skillFiles,
            workflow_files: workflowFiles,
            analysis_timestamp: new Date().toISOString()
        };
        
        this.log(`System: ${totalFiles} files, ${Math.round(agentsSize / 1024)}KB total`, 'info');
    }

    getDirectorySize(dirPath) {
        let totalSize = 0;
        
        if (!fs.existsSync(dirPath)) {
            return 0;
        }
        
        const items = fs.readdirSync(dirPath);
        
        for (const item of items) {
            const itemPath = path.join(dirPath, item);
            const stats = fs.statSync(itemPath);
            
            if (stats.isDirectory()) {
                totalSize += this.getDirectorySize(itemPath);
            } else {
                totalSize += stats.size;
            }
        }
        
        return totalSize;
    }

    countFiles(dirPath) {
        let fileCount = 0;
        
        if (!fs.existsSync(dirPath)) {
            return 0;
        }
        
        const items = fs.readdirSync(dirPath);
        
        for (const item of items) {
            const itemPath = path.join(dirPath, item);
            const stats = fs.statSync(itemPath);
            
            if (stats.isDirectory()) {
                fileCount += this.countFiles(itemPath);
            } else {
                fileCount++;
            }
        }
        
        return fileCount;
    }

    generateRecommendations() {
        const recommendations = [];
        const { skill_metrics, workflow_metrics, system_metrics } = this.metrics;
        
        // Analyze skill performance
        const skillScores = Object.values(skill_metrics).map(m => m.performance_score);
        const avgSkillScore = skillScores.length > 0 ? skillScores.reduce((a, b) => a + b, 0) / skillScores.length : 0;
        
        if (avgSkillScore < 70) {
            recommendations.push({
                type: 'performance',
                priority: 'high',
                message: 'Average skill performance is below optimal. Consider optimizing skill documentation.',
                details: `Average score: ${Math.round(avgSkillScore)}`
            });
        }
        
        // Check for oversized files
        const largeSkills = Object.values(skill_metrics).filter(m => m.file_size_kb > 50);
        if (largeSkills.length > 0) {
            recommendations.push({
                type: 'size',
                priority: 'medium',
                message: `${largeSkills.length} skills have large file sizes (>50KB). Consider breaking down complex skills.`,
                details: largeSkills.map(s => `${s.skill_name} (${s.file_size_kb}KB)`).join(', ')
            });
        }
        
        // Check for missing front matter
        const skillsWithoutFrontMatter = Object.values(skill_metrics).filter(m => !m.has_front_matter);
        if (skillsWithoutFrontMatter.length > 0) {
            recommendations.push({
                type: 'structure',
                priority: 'high',
                message: `${skillsWithoutFrontMatter.length} skills missing front matter. Add proper YAML front matter.`,
                details: skillsWithoutFrontMatter.map(s => s.skill_name).join(', ')
            });
        }
        
        // Analyze workflow performance
        const workflowScores = Object.values(workflow_metrics).map(m => m.performance_score);
        const avgWorkflowScore = workflowScores.length > 0 ? workflowScores.reduce((a, b) => a + b, 0) / workflowScores.length : 0;
        
        if (avgWorkflowScore < 70) {
            recommendations.push({
                type: 'performance',
                priority: 'medium',
                message: 'Average workflow performance could be improved. Add more detailed steps and examples.',
                details: `Average score: ${Math.round(avgWorkflowScore)}`
            });
        }
        
        // System recommendations
        if (system_metrics.agents_directory_size_kb > 1000) {
            recommendations.push({
                type: 'maintenance',
                priority: 'low',
                message: '.agents directory is growing large. Consider archiving old logs and reports.',
                details: `Current size: ${system_metrics.agents_directory_size_kb}KB`
            });
        }
        
        this.metrics.summary.recommendations = recommendations;
        
        // Log recommendations
        if (recommendations.length > 0) {
            this.log('Performance Recommendations:', 'info');
            recommendations.forEach((rec, index) => {
                const priority = rec.priority === 'high' ? 'HIGH' : rec.priority === 'medium' ? 'MED' : 'LOW';
                this.log(`  ${index + 1}. [${priority}] ${rec.message}`, 'warn');
            });
        } else {
            this.log('No performance issues detected - system is optimized!', 'good');
        }
    }

    calculateOverallPerformance() {
        const { skill_metrics, workflow_metrics } = this.metrics;
        
        const skillScores = Object.values(skill_metrics).map(m => m.performance_score);
        const workflowScores = Object.values(workflow_metrics).map(m => m.performance_score);
        
        const avgSkillScore = skillScores.length > 0 ? skillScores.reduce((a, b) => a + b, 0) / skillScores.length : 100;
        const avgWorkflowScore = workflowScores.length > 0 ? workflowScores.reduce((a, b) => a + b, 0) / workflowScores.length : 100;
        
        // Weight skills more heavily than workflows
        const overallScore = (avgSkillScore * 0.7) + (avgWorkflowScore * 0.3);
        
        this.metrics.summary.performance_score = Math.round(overallScore);
        this.metrics.summary.average_skill_size = skillScores.length > 0 
            ? Math.round(Object.values(skill_metrics).reduce((sum, m) => sum + m.file_size_kb, 0) / skillScores.length * 100) / 100
            : 0;
        this.metrics.summary.average_workflow_size = workflowScores.length > 0
            ? Math.round(Object.values(workflow_metrics).reduce((sum, m) => sum + m.file_size_kb, 0) / workflowScores.length * 100) / 100
            : 0;
        this.metrics.summary.total_skills_analyzed = skillScores.length;
        this.metrics.summary.total_workflows_analyzed = workflowScores.length;
    }

    generateReport() {
        this.metrics.duration = performance.now() - this.startTime;
        
        const report = {
            ...this.metrics,
            generated_at: new Date().toISOString(),
            environment: {
                node_version: process.version,
                platform: process.platform,
                memory_usage: process.memoryUsage()
            }
        };
        
        fs.writeFileSync(PERFORMANCE_REPORT_PATH, JSON.stringify(report, null, 2));
        this.log(`Performance report saved to: ${PERFORMANCE_REPORT_PATH}`, 'info');
        
        return report;
    }

    async runPerformanceAnalysis() {
        this.log('Starting performance analysis...', 'info');
        this.log(`Base directory: ${BASE_DIR}`, 'info');
        
        // Analyze skills
        this.log('Analyzing skill performance...', 'info');
        if (fs.existsSync(SKILLS_DIR)) {
            const skillDirs = fs.readdirSync(SKILLS_DIR).filter(item => {
                const itemPath = path.join(SKILLS_DIR, item);
                return fs.statSync(itemPath).isDirectory();
            });

            for (const skillDir of skillDirs) {
                const skillPath = path.join(SKILLS_DIR, skillDir);
                this.analyzeSkillPerformance(skillPath, skillDir);
            }
        }

        // Analyze workflows
        this.log('Analyzing workflow performance...', 'info');
        const workflowsDir = path.join(BASE_DIR, '.windsurf', 'workflows');
        if (fs.existsSync(workflowsDir)) {
            const workflowFiles = fs.readdirSync(workflowsDir).filter(file => file.endsWith('.md'));
            
            for (const workflowFile of workflowFiles) {
                const workflowPath = path.join(workflowsDir, workflowFile);
                const workflowName = workflowFile.replace('.md', '');
                this.analyzeWorkflowPerformance(workflowPath, workflowName);
            }
        }

        // System metrics
        this.analyzeSystemMetrics();

        // Calculate overall performance
        this.calculateOverallPerformance();

        // Generate recommendations
        this.generateRecommendations();

        // Generate report
        const report = this.generateReport();

        // Summary
        this.log('=== Performance Analysis Summary ===', 'info');
        this.log(`Overall performance score: ${this.metrics.summary.performance_score}/100`, 'info');
        this.log(`Skills analyzed: ${this.metrics.summary.total_skills_analyzed}`, 'info');
        this.log(`Workflows analyzed: ${this.metrics.summary.total_workflows_analyzed}`, 'info');
        this.log(`Average skill size: ${this.metrics.summary.average_skill_size}KB`, 'info');
        this.log(`Average workflow size: ${this.metrics.summary.average_workflow_size}KB`, 'info');
        this.log(`Analysis duration: ${Math.round(this.metrics.duration)}ms`, 'info');
        this.log(`Recommendations: ${this.metrics.summary.recommendations.length}`, 'info');

        return report;
    }
}

// CLI interface
async function main() {
    const monitor = new PerformanceMonitor();
    
    try {
        const report = await monitor.runPerformanceAnalysis();
        process.exit(report.summary.performance_score < 60 ? 1 : 0);
    } catch (error) {
        console.error('Performance analysis failed:', error);
        process.exit(1);
    }
}

// Export for use in other modules
module.exports = { PerformanceMonitor };

// Run if called directly
if (require.main === module) {
    main();
}
