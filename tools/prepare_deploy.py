"""Build a clean, reproducible deployment tree without private runtime files."""
from pathlib import Path
from datetime import datetime, timezone
import shutil

root = Path(__file__).resolve().parent.parent
destination = root / 'output' / 'deploy-review'
if destination.exists():
    archive = root / 'output' / 'archive' / ('deploy-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ'))
    assert destination.resolve().is_relative_to(root / 'output')
    assert archive.resolve().is_relative_to(root / 'output')
    archive.parent.mkdir(parents=True, exist_ok=True)
    destination.rename(archive)
destination.mkdir(parents=True)
shutil.copytree(root / 'FrontEnd', destination / 'FrontEnd')
backend = destination / 'BackEnd'
backend.mkdir()
for name in ['server.js', 'emails.js', 'validation.js', 'package.json', 'package-lock.json', 'nodemon.json', '.env.example']:
    shutil.copy2(root / 'BackEnd' / name, backend / name)
shutil.copytree(root / 'BackEnd' / 'assets', backend / 'assets')
shutil.copytree(root / 'BackEnd' / 'test', backend / 'test')
shutil.copy2(root / 'README.md', destination / 'README.md')
if (root / 'package.json').exists():
    shutil.copy2(root / 'package.json', destination / 'package.json')
print('Prepared output/deploy-review from current source; no credentials, logs or runtime data included.')
