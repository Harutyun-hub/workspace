#!/usr/bin/env python3
import http.server
import socketserver
import os
import json
import sys
import signal
import urllib.request
import urllib.error
from datetime import datetime
from urllib.parse import urlparse, parse_qs, unquote

PORT = 5000

SUPABASE_URL = os.environ.get('SUPABASE_URL', '')
SUPABASE_ANON_KEY = os.environ.get('SUPABASE_ANON_KEY', '')

if not SUPABASE_URL:
    print("ERROR: Missing environment variable SUPABASE_URL", file=sys.stderr)
    print(f"Available env vars: {list(os.environ.keys())[:10]}", file=sys.stderr)
    sys.exit(1)

if not SUPABASE_ANON_KEY:
    print("ERROR: Missing environment variable SUPABASE_ANON_KEY", file=sys.stderr)
    sys.exit(1)

INDUSTRY_CONFIG = {
    'igaming': {
        'supabase_url': os.environ.get('IGAMING_SUPABASE_URL', ''),
        'supabase_anon_key': os.environ.get('IGAMING_SUPABASE_ANON_KEY', ''),
        'n8n_webhook': os.environ.get('IGAMING_N8N_WEBHOOK', ''),
    },
    'finance': {
        'supabase_url': os.environ.get('FINANCE_SUPABASE_URL', ''),
        'supabase_anon_key': os.environ.get('FINANCE_SUPABASE_ANON_KEY', ''),
        'n8n_webhook': os.environ.get('FINANCE_N8N_WEBHOOK', ''),
    },
}

ALLOWED_BASE_DOMAINS = ('deepcontext.am', 'replit.dev', 'replit.app', 'localhost')

def get_industry_from_host(host_header):
    """Extract industry from subdomain. Returns None for main domain.
    Only routes subdomains for allowed base domains (security constraint).
    """
    if not host_header:
        return None
    host = host_header.split(':')[0].lower()
    parts = host.split('.')
    
    if len(parts) >= 3:
        subdomain = parts[0]
        base_domain = '.'.join(parts[-2:]) if len(parts) >= 2 else ''
        
        is_allowed_domain = any(
            host.endswith(allowed) or host == allowed 
            for allowed in ALLOWED_BASE_DOMAINS
        )
        
        if is_allowed_domain and subdomain in INDUSTRY_CONFIG:
            return subdomain
    return None

def get_config_for_request(host_header):
    """Get Supabase config based on Host header. Main domain uses default config."""
    industry = get_industry_from_host(host_header)
    if industry:
        config = INDUSTRY_CONFIG[industry]
        if config['supabase_url'] and config['supabase_anon_key']:
            return {
                'url': config['supabase_url'],
                'anon_key': config['supabase_anon_key'],
                'n8n_webhook': config['n8n_webhook'],
                'industry': industry,
                'is_subdomain': True
            }
    return {
        'url': SUPABASE_URL,
        'anon_key': SUPABASE_ANON_KEY,
        'n8n_webhook': '',
        'industry': 'default',
        'is_subdomain': False
    }

print(f"Configuration loaded successfully")
print(f"Industry configs available: {list(INDUSTRY_CONFIG.keys())}")

MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.ico': 'image/x-icon',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.eot': 'application/vnd.ms-fontobject',
}


def log_request(method, path, status_code=None):
    """Log request with timestamp."""
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    status_str = f" - {status_code}" if status_code else ""
    print(f"[INFO] {timestamp} - {method} {path}{status_str}")


def log_error(message):
    """Log error with timestamp."""
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    print(f"[ERROR] {timestamp} - {message}", file=sys.stderr)


class ThreadingHTTPServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    """HTTP server that handles each request in a separate thread."""
    allow_reuse_address = True
    daemon_threads = True


CONFIG_SCRIPT_TEMPLATE_DEFAULT = '''<script>
window.__SUPABASE_CONFIG__ = {{
    url: "{url}",
    anonKey: "{anon_key}"
}};
</script>'''

CONFIG_SCRIPT_TEMPLATE_INDUSTRY = '''<script>
window.__SUPABASE_CONFIG__ = {{
    url: "{url}",
    anonKey: "{anon_key}",
    n8nWebhook: "{n8n_webhook}",
    industry: "{industry}"
}};
</script>'''

class ProductionHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    """Production-grade HTTP request handler with proper error handling."""
    
    _skip_default_cache_headers = False
    
    def end_headers(self):
        if not self._skip_default_cache_headers:
            self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
            self.send_header('Expires', '0')
        self._skip_default_cache_headers = False
        super().end_headers()
    
    def guess_type(self, path):
        """Return the MIME type based on file extension."""
        _, ext = os.path.splitext(path)
        ext = ext.lower()
        if ext in MIME_TYPES:
            return MIME_TYPES[ext]
        return super().guess_type(path)
    
    def _inject_config_into_html(self, content):
        """Inject Supabase config directly into HTML to eliminate /api/config round-trip."""
        host_header = self.headers.get('Host', '')
        config = get_config_for_request(host_header)
        
        if config['is_subdomain']:
            config_script = CONFIG_SCRIPT_TEMPLATE_INDUSTRY.format(
                url=config['url'],
                anon_key=config['anon_key'],
                n8n_webhook=config['n8n_webhook'],
                industry=config['industry']
            )
        else:
            config_script = CONFIG_SCRIPT_TEMPLATE_DEFAULT.format(
                url=config['url'],
                anon_key=config['anon_key']
            )
        
        if b'</head>' in content:
            content = content.replace(b'</head>', config_script.encode('utf-8') + b'\n</head>')
        
        return content
    
    def do_GET(self):
        """Handle GET requests with comprehensive error handling."""
        try:
            parsed_path = urlparse(self.path)
            path = parsed_path.path
            
            log_request('GET', self.path)
            
            if path == '/api/config':
                self._handle_api_config()
            elif path == '/api/proxy-image':
                self._handle_proxy_image(parsed_path.query)
            elif path.endswith('.html') or path == '/' or path == '':
                self._handle_html_with_config(path)
            else:
                super().do_GET()
                
        except BrokenPipeError:
            log_error(f"Client disconnected: {self.path}")
        except ConnectionResetError:
            log_error(f"Connection reset by client: {self.path}")
        except Exception as e:
            log_error(f"Internal server error handling {self.path}: {str(e)}")
            self._send_error_response(500, "Internal Server Error")
    
    def _handle_html_with_config(self, path):
        """Serve HTML files with embedded Supabase config."""
        try:
            if path == '/' or path == '':
                path = '/index.html'
            
            file_path = '.' + path
            
            if not os.path.exists(file_path):
                self.send_error(404, 'File not found')
                return
            
            with open(file_path, 'rb') as f:
                content = f.read()
            
            content = self._inject_config_into_html(content)
            
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Content-Length', str(len(content)))
            self.end_headers()
            self.wfile.write(content)
            
        except Exception as e:
            log_error(f"Error serving HTML with config: {str(e)}")
            self.send_error(500, 'Internal Server Error')
    
    def _handle_api_config(self):
        """Handle the /api/config endpoint (fallback for cached clients)."""
        try:
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
            host_header = self.headers.get('Host', '')
            config = get_config_for_request(host_header)
            
            if config['is_subdomain']:
                response_config = {
                    'SUPABASE_URL': config['url'],
                    'SUPABASE_ANON_KEY': config['anon_key'],
                    'N8N_WEBHOOK': config['n8n_webhook'],
                    'INDUSTRY': config['industry']
                }
            else:
                response_config = {
                    'SUPABASE_URL': config['url'],
                    'SUPABASE_ANON_KEY': config['anon_key']
                }
            
            response_data = json.dumps(response_config).encode('utf-8')
            self.wfile.write(response_data)
            
        except Exception as e:
            log_error(f"Error in /api/config: {str(e)}")
            raise
    
    def _handle_proxy_image(self, query_string):
        """Proxy external images (Instagram CDN) to bypass hotlink protection."""
        image_url = None
        try:
            params = parse_qs(query_string)
            image_url = params.get('url', [None])[0]
            
            if not image_url:
                self._send_error_response(400, "Missing 'url' parameter")
                return
            
            image_url = unquote(image_url)
            
            parsed_url = urlparse(image_url)
            hostname = parsed_url.hostname or ''
            
            if parsed_url.scheme != 'https':
                self._send_error_response(403, "Only HTTPS URLs allowed")
                return
            
            allowed_suffixes = ('.cdninstagram.com', '.instagram.com')
            allowed_exact = ('cdninstagram.com', 'instagram.com')
            is_allowed = hostname in allowed_exact or hostname.endswith(allowed_suffixes)
            
            if not is_allowed:
                self._send_error_response(403, "Domain not allowed")
                return
            
            req = urllib.request.Request(
                image_url,
                headers={
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Referer': '',
                }
            )
            
            with urllib.request.urlopen(req, timeout=10) as response:
                image_data = response.read()
                content_type = response.headers.get('Content-Type', 'image/jpeg')
            
            self.send_response(200)
            self.send_header('Content-Type', content_type)
            self.send_header('Content-Length', str(len(image_data)))
            self.send_header('Cache-Control', 'public, max-age=86400')
            self.send_header('Access-Control-Allow-Origin', '*')
            self._skip_default_cache_headers = True
            self.end_headers()
            self.wfile.write(image_data)
            
        except urllib.error.HTTPError as e:
            log_error(f"HTTP error fetching image: {e.code} - {image_url}")
            self._send_error_response(e.code, f"Image fetch failed: {e.reason}")
        except urllib.error.URLError as e:
            log_error(f"URL error fetching image: {str(e)} - {image_url}")
            self._send_error_response(502, "Failed to fetch image")
        except Exception as e:
            log_error(f"Error proxying image: {str(e)}")
            self._send_error_response(500, "Internal proxy error")
    
    def _send_error_response(self, status_code, message):
        """Send a proper error response."""
        try:
            self.send_response(status_code)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            
            error_response = json.dumps({
                'error': message,
                'status': status_code
            }).encode('utf-8')
            
            self.wfile.write(error_response)
        except Exception as e:
            log_error(f"Failed to send error response: {str(e)}")
    
    def log_message(self, format, *args):
        """Override default logging to use our custom logger."""
        pass


httpd = None


def signal_handler(signum, frame):
    """Handle shutdown signals gracefully."""
    print(f"\n[INFO] {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} - Received shutdown signal, closing server...")
    if httpd:
        httpd.shutdown()
        httpd.server_close()
    print(f"[INFO] {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} - Server shut down gracefully")
    sys.exit(0)


def main():
    global httpd
    
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    try:
        httpd = ThreadingHTTPServer(("0.0.0.0", PORT), ProductionHTTPRequestHandler)
        print(f"[INFO] {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} - Server running at http://0.0.0.0:{PORT}/")
        print(f"[INFO] {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} - Press Ctrl+C to stop the server")
        httpd.serve_forever()
    except OSError as e:
        if e.errno == 98:
            log_error(f"Port {PORT} is already in use. Please wait a moment or use a different port.")
        else:
            log_error(f"Failed to start server: {str(e)}")
        sys.exit(1)
    except Exception as e:
        log_error(f"Unexpected error starting server: {str(e)}")
        sys.exit(1)


if __name__ == "__main__":
    main()
