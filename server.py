#!/usr/bin/env python3
import http.server
import socketserver
import os
import json
import sys
from urllib.parse import urlparse, parse_qs

PORT = int(os.environ.get('PORT', 5000))

# Multi-tenant configuration
TENANT_CONFIGS = {
    'igaming': {
        'SUPABASE_URL': os.environ.get('IGAMING_SUPABASE_URL', ''),
        'SUPABASE_ANON_KEY': os.environ.get('IGAMING_SUPABASE_ANON_KEY', ''),
    },
    'finance': {
        'SUPABASE_URL': os.environ.get('FINANCE_SUPABASE_URL', ''),
        'SUPABASE_ANON_KEY': os.environ.get('FINANCE_SUPABASE_ANON_KEY', ''),
    }
}

def get_tenant_from_host(host):
    """Extract tenant from hostname. Main domain and igaming subdomain both map to igaming."""
    if not host:
        return 'igaming'  # Default to igaming
    
    # Remove port if present
    host = host.split(':')[0].lower()
    
    # finance.deepcontex.am or finance.* → finance tenant
    if 'finance.' in host:
        return 'finance'
    
    # igaming.deepcontex.am, deepcontex.am, or any other → igaming tenant (default)
    return 'igaming'

# Validate that required environment variables are set
missing_vars = []
for tenant, config in TENANT_CONFIGS.items():
    if not config['SUPABASE_URL']:
        missing_vars.append(f'{tenant.upper()}_SUPABASE_URL')
    if not config['SUPABASE_ANON_KEY']:
        missing_vars.append(f'{tenant.upper()}_SUPABASE_ANON_KEY')

if missing_vars:
    print("ERROR: Missing required environment variables:", ', '.join(missing_vars), file=sys.stderr)
    print(f"Available env vars: {list(os.environ.keys())}", file=sys.stderr)
    sys.exit(1)

print(f"✓ Multi-tenant configuration loaded successfully")
print(f"  Tenants configured: {', '.join(TENANT_CONFIGS.keys())}")

class MyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        self.send_header('Expires', '0')
        super().end_headers()
    
    def do_GET(self):
        if self.path == '/api/config':
            # Get tenant from Host header
            host = self.headers.get('Host', '')
            tenant = get_tenant_from_host(host)
            
            # Get configuration for this tenant
            config = TENANT_CONFIGS.get(tenant, TENANT_CONFIGS['igaming'])
            
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
            # Add tenant info for debugging (optional, can remove in production)
            response = {
                **config,
                'tenant': tenant  # Let frontend know which tenant it's using
            }
            
            self.wfile.write(json.dumps(response).encode())
        else:
            super().do_GET()

socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("0.0.0.0", PORT), MyHTTPRequestHandler) as httpd:
    print(f"Server running at http://0.0.0.0:{PORT}/")
    httpd.serve_forever()
