"""Small on-demand media worker for optional Demucs vocal separation.

The Node worker owns MongoDB leases and calls this process/container only when
the quality evaluator requests vocal separation. The process never owns a job
lease and can therefore run as a local subprocess or an Azure Container Apps
Job without changing the API worker.
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import tempfile
import os
import sys
import wave
from pathlib import Path


def separate_vocals(input_path: Path, output_path: Path) -> None:
    if not input_path.exists() or input_path.stat().st_size <= 0:
        raise ValueError("MEDIA_INPUT_INVALID")
    with wave.open(str(input_path), 'rb') as source:
        if source.getnframes() <= 0 or source.getframerate() != 44100:
            raise ValueError('DEMUCS_REQUIRES_44100_SOURCE')
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="hanflix-demucs-") as temp:
        command = [
            sys.executable, "-m", "demucs", "--device", "cpu",
            "--two-stems=vocals",
            "-n", "htdemucs",
            "-o", temp,
            str(input_path),
        ]
        subprocess.run(command, check=True, capture_output=True, text=True, timeout=840)
        matches = list(Path(temp).glob("**/vocals.wav"))
        if not matches:
            raise RuntimeError("DEMUCS_OUTPUT_MISSING")
        shutil.copyfile(matches[0], output_path)
        with wave.open(str(output_path), 'rb') as audio:
            if audio.getnframes() <= 0 or audio.getframerate() != 44100:
                raise RuntimeError('DEMUCS_OUTPUT_INVALID')


def r2_separate_vocals() -> None:
    import boto3
    from botocore.exceptions import ClientError
    input_key = os.environ['MEDIA_INPUT_KEY']
    output_key = os.environ['MEDIA_OUTPUT_KEY']
    if not input_key.startswith('processing/') or not output_key.startswith('processing/'):
        raise ValueError('MEDIA_KEY_INVALID')
    client = boto3.client('s3', endpoint_url=os.environ['R2_ENDPOINT'],
                          aws_access_key_id=os.environ['R2_ACCESS_KEY_ID'],
                          aws_secret_access_key=os.environ['R2_SECRET_ACCESS_KEY'], region_name='auto')
    bucket = os.environ['R2_BUCKET_NAME']
    try:
        if client.head_object(Bucket=bucket, Key=output_key)['ContentLength'] > 44:
            print(json.dumps({'status': 'completed', 'outputKey': output_key, 'reused': True}))
            return
    except ClientError as error:
        if error.response['ResponseMetadata']['HTTPStatusCode'] != 404:
            raise
    with tempfile.TemporaryDirectory(prefix='hanflix-media-') as temp:
        source, target = Path(temp) / 'source.wav', Path(temp) / 'vocals.wav'
        client.download_file(bucket, input_key, str(source))
        separate_vocals(source, target)
        client.upload_file(str(target), bucket, output_key, ExtraArgs={'ContentType': 'audio/wav'})
    print(json.dumps({'status': 'completed', 'outputKey': output_key}))


def main() -> None:
    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers(dest="command", required=True)
    separate = subparsers.add_parser("separate-vocals")
    separate.add_argument("--input", required=True, type=Path)
    separate.add_argument("--output", required=True, type=Path)
    subparsers.add_parser('r2-separate-vocals')
    args = parser.parse_args()

    if args.command == "separate-vocals":
        separate_vocals(args.input, args.output)
        print(json.dumps({"status": "completed", "output": str(args.output)}))
    elif args.command == 'r2-separate-vocals':
        r2_separate_vocals()


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(json.dumps({'status': 'failed', 'errorCode': type(error).__name__}), file=sys.stderr)
        sys.exit(1)
