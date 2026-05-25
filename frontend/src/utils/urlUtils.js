export function resolveApiUrl(path) {
    if (!path)
        return '';
    if (path.startsWith('http') || path.startsWith('data:'))
        return path;
    const baseUrl = window.location.origin.startsWith('file') ? 'http://localhost:3017' : '';
    const cleanPath = path.startsWith('/') ? path : '/' + path;
    return baseUrl + cleanPath;
}
