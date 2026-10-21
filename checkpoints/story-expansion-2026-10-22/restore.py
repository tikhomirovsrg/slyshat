#!/usr/bin/env python3
"""Verify the checkpoint; optionally restore into a clean worktree at its base."""
import argparse
import hashlib
import io
import json
from pathlib import Path, PurePosixPath
import subprocess
import tarfile

HERE = Path(__file__).resolve().parent
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--destination', type=Path, help='Clean Git worktree at baseMainCommit')
args = parser.parse_args()
manifest = json.loads((HERE / 'checkpoint.json').read_text())
parts = []
for item in manifest['parts']:
    assert PurePosixPath(item['path']).name == item['path']
    data = (HERE / item['path']).read_bytes()
    assert len(data) == item['bytes']
    assert hashlib.sha256(data).hexdigest() == item['sha256']
    parts.append(data)
packed = b''.join(parts)
assert len(packed) == manifest['snapshotBytes']
assert hashlib.sha256(packed).hexdigest() == manifest['snapshotSha256']
expected = {item['path']: item for item in manifest['files']}
verified = {}
with tarfile.open(fileobj=io.BytesIO(packed), mode='r:gz') as archive:
    for member in archive.getmembers():
        name = PurePosixPath(member.name)
        assert member.isfile() and not name.is_absolute() and '..' not in name.parts
        assert member.name in expected and member.name not in verified
        data = archive.extractfile(member).read()
        item = expected[member.name]
        assert len(data) == item['bytes']
        assert hashlib.sha256(data).hexdigest() == item['sha256']
        verified[member.name] = data
assert set(verified) == set(expected)
if args.destination:
    target = args.destination.resolve(strict=True)
    def git(*arguments):
        return subprocess.check_output(['git', '-C', str(target), *arguments], text=True).strip()
    assert git('rev-parse', 'HEAD^{tree}') == manifest['baseTree'], 'Wrong base tree'
    assert not git('status', '--porcelain'), 'Destination must be a clean worktree'
    for name, data in verified.items():
        output = target / name
        assert output.resolve().is_relative_to(target)
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_bytes(data)
        output.chmod(expected[name]['mode'])
print(json.dumps({'verifiedFiles': len(verified), 'newStoriesWritten': manifest['newStoriesWritten'],
                  'restored': bool(args.destination), 'sha256': manifest['snapshotSha256']}))
