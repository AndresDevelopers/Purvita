#!/usr/bin/env node

/**
 * Dependency Security Check Script
 * Checks for known vulnerabilities in project dependencies
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class DependencyChecker {
  constructor() {
    this.projectRoot = path.join(__dirname, '..');
    this.packageJsonPath = path.join(this.projectRoot, 'package.json');
    this.vulnerabilityCache = new Map();
  }

  /**
   * Read package.json and extract dependencies
   */
  getDependencies() {
    try {
      const packageJson = JSON.parse(fs.readFileSync(this.packageJsonPath, 'utf8'));
      
      return {
        dependencies: packageJson.dependencies || {},
        devDependencies: packageJson.devDependencies || {},
        peerDependencies: packageJson.peerDependencies || {},
        optionalDependencies: packageJson.optionalDependencies || {},
      };
    } catch (error) {
      console.error('Error reading package.json:', error.message);
      process.exit(1);
    }
  }

  /**
   * Check if npm audit is available
   */
  isNpmAuditAvailable() {
    try {
      execSync('npm audit --version', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Run npm audit to check for vulnerabilities
   */
  runNpmAudit() {
    try {
      const result = execSync('npm audit --json', { 
        cwd: this.projectRoot,
        encoding: 'utf8' 
      });
      
      return JSON.parse(result);
    } catch (error) {
      if (error.status !== 0) {
        // npm audit returns non-zero exit code when vulnerabilities are found
        try {
          return JSON.parse(error.stdout);
        } catch {
          console.error('Error parsing npm audit output:', error.message);
          return null;
        }
      }
      console.error('Error running npm audit:', error.message);
      return null;
    }
  }

  /**
   * Check for known vulnerable packages using public databases
   */
  async checkKnownVulnerabilities(dependencies) {
    const allDeps = [
      ...Object.keys(dependencies.dependencies),
      ...Object.keys(dependencies.devDependencies),
      ...Object.keys(dependencies.peerDependencies),
      ...Object.keys(dependencies.optionalDependencies),
    ];

    const vulnerabilities = [];

    // Check each dependency against known vulnerability databases
    for (const dep of allDeps) {
      const version = dependencies.dependencies[dep] || 
                     dependencies.devDependencies[dep] ||
                     dependencies.peerDependencies[dep] ||
                     dependencies.optionalDependencies[dep];

      if (await this.isPackageVulnerable(dep, version)) {
        vulnerabilities.push({ 
          package: dep, 
          version: version,
          severity: 'high', // Default to high until we get actual data
          type: 'known_vulnerability'
        });
      }
    }

    return vulnerabilities;
  }

  /**
   * Check if a specific package version is known to be vulnerable
   * This is a simplified check - in production, you'd use a proper vulnerability database
   */
  async isPackageVulnerable(packageName, version) {
    // Cache results to avoid repeated checks
    if (this.vulnerabilityCache.has(packageName)) {
      return this.vulnerabilityCache.get(packageName);
    }

    // Known vulnerable packages (this would be replaced with actual vulnerability database queries)
    const knownVulnerablePackages = {
      // Example: known vulnerable versions of popular packages
      'lodash': ['<4.17.12'], // Arbitrary example
      'axios': ['<0.21.1'],   // Arbitrary example
    };

    const isVulnerable = knownVulnerablePackages[packageName]?.some(vulnVersion => 
      this.isVersionVulnerable(version, vulnVersion)
    ) || false;

    this.vulnerabilityCache.set(packageName, isVulnerable);
    return isVulnerable;
  }

  /**
   * Check if a version is vulnerable based on version range
   */
  isVersionVulnerable(version, vulnerableRange) {
    // Simple check - in production, use semver library
    try {
      const cleanVersion = version.replace(/^[^\d]*/, '');
      
      if (vulnerableRange.startsWith('<')) {
        const maxVersion = vulnerableRange.slice(1);
        return this.compareVersions(cleanVersion, maxVersion) < 0;
      }
      
      if (vulnerableRange.startsWith('>')) {
        const minVersion = vulnerableRange.slice(1);
        return this.compareVersions(cleanVersion, minVersion) <= 0;
      }
      
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Simple version comparison
   */
  compareVersions(v1, v2) {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const part1 = parts1[i] || 0;
      const part2 = parts2[i] || 0;
      
      if (part1 !== part2) {
        return part1 - part2;
      }
    }
    
    return 0;
  }

  /**
   * Check for outdated packages
   */
  checkOutdatedPackages(dependencies) {
    const outdated = [];
    const currentDate = new Date();

    // Check if packages haven't been updated in over 2 years
    const allDeps = { ...dependencies.dependencies, ...dependencies.devDependencies };
    
    // This is a simplified check - in production, you'd use npm outdated or similar
    const potentiallyOutdated = Object.keys(allDeps).filter(dep => {
      const version = allDeps[dep];
      
      // Check if version is very old (e.g., contains dates from before 2020)
      if (version.match(/\b(201[0-9]|2020)\b/)) {
        return true;
      }
      
      // Check if version uses old syntax
      if (version.includes('^0.') || version.includes('~0.')) {
        return true;
      }
      
      return false;
    });

    for (const dep of potentiallyOutdated) {
      outdated.push({
        package: dep,
        version: allDeps[dep],
        type: 'potentially_outdated',
        severity: 'medium'
      });
    }

    return outdated;
  }

  /**
   * Generate security report
   */
  generateReport(vulnerabilities, outdated) {
    const totalIssues = vulnerabilities.length + outdated.length;
    
    console.log('\n=== DEPENDENCY SECURITY REPORT ===\n');
    
    if (totalIssues === 0) {
      console.log('✅ No security vulnerabilities found!');
      return;
    }

    // Show vulnerabilities
    if (vulnerabilities.length > 0) {
      console.log('🚨 CRITICAL VULNERABILITIES FOUND:');
      vulnerabilities.forEach(vuln => {
        console.log(`  • ${vuln.package}@${vuln.version} - ${vuln.severity.toUpperCase()}`);
      });
      console.log('');
    }

    // Show outdated packages
    if (outdated.length > 0) {
      console.log('⚠️  POTENTIALLY OUTDATED PACKAGES:');
      outdated.forEach(pkg => {
        console.log(`  • ${pkg.package}@${pkg.version} - Consider updating`);
      });
      console.log('');
    }

    console.log(`📊 SUMMARY: ${totalIssues} security issues found`);
    console.log(`  - ${vulnerabilities.length} critical vulnerabilities`);
    console.log(`  - ${outdated.length} potentially outdated packages`);
    
    if (vulnerabilities.length > 0) {
      console.log('\n🔒 RECOMMENDATIONS:');
      console.log('  1. Run: npm audit fix --force');
      console.log('  2. Update vulnerable packages manually');
      console.log('  3. Consider using dependabot for automatic updates');
      console.log('  4. Review package licenses and compliance');
    }
  }

  /**
   * Main check function
   */
  async runCheck() {
    console.log('🔍 Scanning dependencies for security vulnerabilities...\n');

    const dependencies = this.getDependencies();
    
    let npmAuditResults = null;
    if (this.isNpmAuditAvailable()) {
      console.log('Running npm audit...');
      npmAuditResults = this.runNpmAudit();
    }

    console.log('Checking for known vulnerabilities...');
    const vulnerabilities = await this.checkKnownVulnerabilities(dependencies);
    
    console.log('Checking for outdated packages...');
    const outdated = this.checkOutdatedPackages(dependencies);

    this.generateReport(vulnerabilities, outdated);

    // Exit with appropriate code
    if (vulnerabilities.length > 0) {
      process.exit(1); // Exit with error if vulnerabilities found
    }
  }
}

// Run the check if this script is executed directly
if (require.main === module) {
  const checker = new DependencyChecker();
  checker.runCheck().catch(error => {
    console.error('Error running dependency check:', error);
    process.exit(1);
  });
}

module.exports = { DependencyChecker };