import os
import re


class CodeScanner:
    """
    Lightweight DevSecOps source-code security scanner.

    This scanner is intentionally local and dependency-free.
    It looks for common insecure coding patterns and returns
    structured findings that can later be stored in the database.
    """

    RULES = [
        {
            "id": "SEC001",
            "title": "Hardcoded Password",
            "severity": "HIGH",
            "description": (
                "A possible hardcoded password was detected in source code."
            ),
            "recommendation": (
                "Move credentials to environment variables or a "
                "secure secret-management system."
            ),
            "patterns": [
                r"password\s*=\s*[\"'][^\"']+[\"']",
                r"passwd\s*=\s*[\"'][^\"']+[\"']",
            ],
        },
        {
            "id": "SEC002",
            "title": "Hardcoded API Key",
            "severity": "HIGH",
            "description": (
                "A possible API key or secret was detected in source code."
            ),
            "recommendation": (
                "Remove the secret from source control and use "
                "environment variables or secret management."
            ),
            "patterns": [
                r"api[_-]?key\s*=\s*[\"'][^\"']+[\"']",
                r"secret[_-]?key\s*=\s*[\"'][^\"']+[\"']",
            ],
        },
        {
            "id": "SEC003",
            "title": "Debug Mode Enabled",
            "severity": "MEDIUM",
            "description": (
                "Debug mode appears to be enabled."
            ),
            "recommendation": (
                "Disable debug mode in production deployments."
            ),
            "patterns": [
                r"debug\s*=\s*True",
                r"DEBUG\s*=\s*True",
            ],
        },
        {
            "id": "SEC004",
            "title": "Potential Command Injection",
            "severity": "HIGH",
            "description": (
                "A potentially dangerous shell command execution "
                "pattern was detected."
            ),
            "recommendation": (
                "Avoid passing unsanitized user input to shell commands. "
                "Prefer safe subprocess APIs and strict input validation."
            ),
            "patterns": [
                r"os\.system\s*\(",
                r"subprocess\.Popen\s*\([^)]*shell\s*=\s*True",
                r"subprocess\.run\s*\([^)]*shell\s*=\s*True",
            ],
        },
        {
            "id": "SEC005",
            "title": "SQL Query Construction",
            "severity": "HIGH",
            "description": (
                "A possible dynamically constructed SQL query was detected."
            ),
            "recommendation": (
                "Use parameterized queries or an ORM instead of "
                "concatenating untrusted input."
            ),
            "patterns": [
                r"SELECT\s+.*\+\s*",
                r"INSERT\s+.*\+\s*",
                r"UPDATE\s+.*\+\s*",
                r"DELETE\s+.*\+\s*",
            ],
        },
    ]

    IGNORED_DIRECTORIES = {
        ".git",
        ".venv",
        "venv",
        "node_modules",
        "__pycache__",
        ".idea",
        ".vscode",
        "dist",
        "build",
    }

    SOURCE_EXTENSIONS = {
        ".py",
        ".js",
        ".jsx",
        ".ts",
        ".tsx",
        ".java",
        ".go",
        ".php",
        ".rb",
        ".cs",
        ".cpp",
        ".c",
        ".h",
        ".html",
        ".css",
    }

    def __init__(self, source_directory):
        self.source_directory = os.path.abspath(source_directory)

    def _is_source_file(self, filename):
        _, extension = os.path.splitext(filename)

        return extension.lower() in self.SOURCE_EXTENSIONS

    def _should_ignore(self, directory):
        directory_name = os.path.basename(directory)

        return directory_name in self.IGNORED_DIRECTORIES

    def _read_file(self, file_path):
        try:
            with open(
                file_path,
                "r",
                encoding="utf-8",
                errors="ignore",
            ) as file:
                return file.readlines()

        except (OSError, UnicodeError):
            return []

    def _scan_line(self, line, line_number, file_path):
        findings = []

        for rule in self.RULES:
            for pattern in rule["patterns"]:
                try:
                    matched = re.search(
                        pattern,
                        line,
                        flags=re.IGNORECASE,
                    )
                except re.error:
                    matched = None

                if not matched:
                    continue

                findings.append(
                    {
                        "rule_id": rule["id"],
                        "title": rule["title"],
                        "severity": rule["severity"],
                        "description": rule["description"],
                        "recommendation": rule["recommendation"],
                        "file": os.path.relpath(
                            file_path,
                            self.source_directory,
                        ),
                        "line": line_number,
                        "evidence": line.strip()[:500],
                    }
                )

                break

        return findings

    def scan(self):
        findings = []
        files_scanned = 0

        if not os.path.isdir(self.source_directory):
            raise FileNotFoundError(
                f"Source directory not found: {self.source_directory}"
            )

        for root, directories, files in os.walk(
            self.source_directory
        ):
            directories[:] = [
                directory
                for directory in directories
                if not self._should_ignore(
                    os.path.join(root, directory)
                )
            ]

            for filename in files:
                if not self._is_source_file(filename):
                    continue

                file_path = os.path.join(root, filename)

                lines = self._read_file(file_path)

                if not lines:
                    continue

                files_scanned += 1

                for line_number, line in enumerate(
                    lines,
                    start=1,
                ):
                    findings.extend(
                        self._scan_line(
                            line,
                            line_number,
                            file_path,
                        )
                    )

        return {
            "files_scanned": files_scanned,
            "findings": findings,
            "total_findings": len(findings),
        }