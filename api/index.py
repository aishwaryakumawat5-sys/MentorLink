import os
import sys

# Ensure root directory is on Python search path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app

# Vercel Serverless Handler
# The `@vercel/python` runtime looks for `app` or `handler`
handler = app
