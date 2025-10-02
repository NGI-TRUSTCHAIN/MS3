# Security Policy for M3S (Modular Multi-chain Suite)

The M3S project team, led by **Change TheBlock**, takes the security and integrity of our modular framework and its core packages seriously. We appreciate the efforts of the community and security researchers to practice **Coordinated Vulnerability Disclosure (CVD)**.

## Reporting a Vulnerability (Primary Method)

To ensure the vulnerability remains confidential and is fixed promptly, **DO NOT** open a public issue.

Please report all security vulnerabilities using the private GitHub Security Advisory feature. This directs your report exclusively to the project maintainers (Ángela Herrador and Gunner Andersen Gil).

🔗 **Reportar una Vulnerabilidad Privada:**
[Haga clic aquí para reportar una vulnerabilidad](https://github.com/NGI-TRUSTCHAIN/MS3/security/advisories/new)
The maintainers will acknowledge your report within **48 hours** and keep you informed of the progress toward a fix and public announcement.

---

## 📧 Alternative Contact for Sensitive Reports

If the GitHub Advisory is unavailable or you need to provide sensitive information outside of the platform (e.g., as a core collaborator), you may contact us privately:

**Email:** `m3s@changetheblock.com`

## Disclosure Policy

We follow a Coordinated Vulnerability Disclosure (CVD) process:

1.  **Private Fix:** The vulnerability is confirmed, and a fix is developed privately in an embargoed branch.
2.  **Patch Release:** Once the fix is ready, a new version of the affected M3S packages is prepared for release on NPM.
3.  **Public Disclosure:** The fix is released, and the vulnerability details are published via a **GitHub Security Advisory** simultaneously.

## Supported Versions

Security patches will only be applied to the **latest major version** (currently **v1.0.0** and above) and the corresponding **latest minor release** of all M3S packages.

## Third-Party Dependencies (NPM)

If the vulnerability is found in a library that M3S depends on (a third-party NPM module), please report it directly to the maintainers of that module. For general reports concerning the NPM ecosystem, you can use the [npm contact form](https://www.npmjs.com/support) by selecting "I'm reporting a security vulnerability."
