#!/usr/bin/env python3
import http.server
import socketserver
import os
import json
import sys
import signal
from datetime import datetime
from urllib.parse import urlparse

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

print(f"Configuration loaded successfully")

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


class ProductionHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    """Production-grade HTTP request handler with proper error handling."""
    
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        self.send_header('Expires', '0')
        super().end_headers()
    
    def guess_type(self, path):
        """Return the MIME type based on file extension."""
        _, ext = os.path.splitext(path)
        ext = ext.lower()
        if ext in MIME_TYPES:
            return MIME_TYPES[ext]
        return super().guess_type(path)
    
    def do_GET(self):
        """Handle GET requests with comprehensive error handling."""
        try:
            parsed_path = urlparse(self.path)
            path = parsed_path.path
            
            log_request('GET', self.path)
            
            if path == '/api/config':
                self._handle_api_config()
            else:
                super().do_GET()
                
        except BrokenPipeError:
            log_error(f"Client disconnected: {self.path}")
        except ConnectionResetError:
            log_error(f"Connection reset by client: {self.path}")
        except Exception as e:
            log_error(f"Internal server error handling {self.path}: {str(e)}")
            self._send_error_response(500, "Internal Server Error")
    
    def _handle_api_config(self):
        """Handle the /api/config endpoint."""
        try:
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
            config = {
                'SUPABASE_URL': os.environ.get('SUPABASE_URL', ''),
                'SUPABASE_ANON_KEY': os.environ.get('SUPABASE_ANON_KEY', '')
            }
            
            response_data = json.dumps(config).encode('utf-8')
            self.wfile.write(response_data)
            
        except Exception as e:
            log_error(f"Error in /api/config: {str(e)}")
            raise
    
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
