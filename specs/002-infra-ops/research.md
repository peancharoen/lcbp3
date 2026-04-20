# Phase 0 Research: Infrastructure Operations & Deployment Automation

**Date**: 2026-04-20  
**Feature**: Infrastructure Operations & Deployment Automation  
**Status**: Complete

## Research Findings

### Blue-Green Deployment Strategy

**Decision**: Docker Compose with Nginx Proxy Manager for traffic switching  
**Rationale**: Provides zero-downtime deployments by maintaining two identical production environments (blue/green) and switching traffic via reverse proxy configuration updates  
**Alternatives Considered**: Kubernetes (too complex for current scale), Docker Swarm (limited networking features), Manual deployment scripts (prone to human error)

### Backup & Recovery Solution

**Decision**: Restic for encrypted backups + MariaDB dump scripts + automated validation  
**Rationale**: Restic provides deduplication, encryption, and cloud storage support. Combined with native database dumps ensures complete system state capture  
**Alternatives Considered**: Borg Backup (steeper learning curve), rsync only (no encryption/deduplication), commercial solutions (cost constraints)

### Monitoring Stack

**Decision**: Prometheus + Grafana + AlertManager + Node Exporter + cAdvisor  
**Rationale**: Industry-standard monitoring stack with extensive community support, flexible alerting rules, and container-native metrics collection  
**Alternatives Considered**: Zabbix (more complex setup), Nagios (older architecture), Datadog (commercial cost)

### Container Security Hardening

**Decision**: Docker security hardening with non-root users, read-only filesystems, capability dropping, and Trivy scanning  
**Rationale**: Provides defense-in-depth security while maintaining functionality. Trivy offers comprehensive vulnerability scanning  
**Alternatives Considered**: Podman (better security but ecosystem compatibility issues), Kubernetes security policies (overkill for current scale)

### Multi-NAS Architecture

**Decision**: QNAP for primary services, ASUSTOR for backup/monitoring registry  
**Rationale**: Leverages existing hardware investment, provides geographic separation for critical services, and maintains established SSH key authentication  
**Alternatives Considered**: Cloud hosting (recurring costs, data sovereignty concerns), Single NAS (single point of failure)

### SSL Certificate Management

**Decision**: Certbot with Let's Encrypt + automated renewal via cron jobs  
**Rationale**: Free, automated certificate management with established reliability. Integration with Nginx Proxy Manager simplifies deployment  
**Alternatives Considered**: Commercial CAs (cost), Self-signed certificates (browser warnings), Cloudflare certificates (dependency on external service)

### Secrets Management

**Decision**: Environment files with .gitignore + SSH key authentication  
**Rationale**: Simple, secure approach that works across both NAS environments. No additional infrastructure required  
**Alternatives Considered**: HashiCorp Vault (complex setup), Docker Swarm secrets (limited to single host), Infisical/SOPS (additional learning curve)

## Technical Decisions Summary

1. **Docker Compose** as primary orchestration tool
2. **Blue-Green deployment** pattern for zero downtime
3. **Restic** for backup encryption and deduplication
4. **Prometheus/Grafana** stack for monitoring
5. **Nginx Proxy Manager** for reverse proxy and SSL termination
6. **Trivy** for container vulnerability scanning
7. **Environment files** for secrets management
8. **SSH key authentication** for cross-NAS communication

## Implementation Constraints

- Must maintain existing QNAP/ASUSTOR IP addresses (192.168.10.8/9)
- Must preserve current data storage locations
- Must integrate with existing Gitea Actions CI/CD pipeline
- Must comply with ADR-016 security requirements
- Must support Thai language documentation per project standards

## Success Metrics Alignment

All technical decisions support the success criteria defined in the specification:

- 99.9% uptime through redundant infrastructure
- 30-second alert generation via Prometheus monitoring
- 4-hour RTO through automated backup validation
- Zero-downtime deployments via blue-green strategy
- 100% security compliance via container hardening

## Next Steps

Proceed to Phase 1: Design & Contracts with these technical foundations established.
