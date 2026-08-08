const SECRET_NAME = /(token|secret|password|passwd|api[_-]?key|authorization|cookie)/i;
export function redactText(value) {
    let output = value;
    const candidates = Object.entries(process.env)
        .filter(([name, secret]) => SECRET_NAME.test(name) && secret && secret.length >= 6)
        .map(([, secret]) => secret)
        .sort((a, b) => b.length - a.length);
    for (const secret of candidates) {
        output = output.split(secret).join("[REDACTED]");
    }
    output = output.replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{8,}/gi, "$1 [REDACTED]");
    return output;
}
//# sourceMappingURL=redact.js.map