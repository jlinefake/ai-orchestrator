#!/usr/bin/env python3
"""
SWE-bench Evaluation Bridge

Bridge script to run SWE-bench evaluation from TypeScript runner.
Takes predictions JSON and outputs evaluation results.
"""

import sys
import json
import os
import subprocess
from pathlib import Path
from typing import Dict, List, Any

def check_docker() -> bool:
    """Check if Docker is available and running."""
    try:
        result = subprocess.run(
            ['docker', 'info'],
            capture_output=True,
            timeout=10
        )
        return result.returncode == 0
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return False

def run_evaluation(predictions_path: str, output_path: str = None) -> Dict[str, Any]:
    """
    Run SWE-bench evaluation on predictions.

    Args:
        predictions_path: Path to predictions JSON file
        output_path: Optional path to save results

    Returns:
        Evaluation results as dictionary
    """
    if not os.path.exists(predictions_path):
        return {
            'error': f'Predictions file not found: {predictions_path}',
            'success': False
        }

    # Check Docker
    if not check_docker():
        return {
            'error': 'Docker is not running. Please start Docker Desktop.',
            'success': False
        }

    # Load predictions
    try:
        with open(predictions_path, 'r') as f:
            predictions = json.load(f)
    except Exception as e:
        return {
            'error': f'Failed to load predictions: {str(e)}',
            'success': False
        }

    if not predictions:
        return {
            'error': 'No predictions found in file',
            'success': False
        }

    # Create temporary directory for evaluation
    temp_dir = Path(predictions_path).parent / 'eval_temp'
    temp_dir.mkdir(exist_ok=True)

    # Generate a run ID from the predictions file name
    run_id = Path(predictions_path).stem or 'benchmark_run'

    # Create report directory
    report_dir = temp_dir / 'reports'
    report_dir.mkdir(exist_ok=True)

    # Run SWE-bench evaluation (updated API for swebench >= 2.0)
    try:
        # Extract instance IDs from predictions
        instance_ids = [p['instance_id'] for p in predictions]

        cmd = [
            sys.executable, '-m', 'swebench.harness.run_evaluation',
            '--predictions_path', predictions_path,
            '--run_id', run_id,
            '--dataset_name', 'princeton-nlp/SWE-bench_Lite',
            '--split', 'test',
            '--timeout', '900',
            '--max_workers', '1',
            '--report_dir', str(report_dir),
            '--instance_ids',
        ] + instance_ids

        print(f"Running evaluation: {' '.join(cmd[:10])}... ({len(instance_ids)} instances)", file=sys.stderr)

        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=7200  # 2 hour total timeout
        )

        if result.returncode != 0:
            # Check if it's just the deprecated API — try fallback
            if 'run_id' in result.stderr and 'unrecognized' in result.stderr:
                return _run_evaluation_legacy(predictions_path, predictions, temp_dir, output_path)
            return {
                'error': f'Evaluation failed: {result.stderr}',
                'success': False,
                'stdout': result.stdout,
                'stderr': result.stderr
            }

        # Find report results
        results = _find_evaluation_results(report_dir, temp_dir, run_id)
        if results is None:
            # Parse from stdout if possible
            results = _parse_stdout_results(result.stdout, predictions)

        # Save results if output path specified
        if output_path and results:
            with open(output_path, 'w') as f:
                json.dump(results, f, indent=2)

        return {
            'success': True,
            'results': results or [],
            'predictions_count': len(predictions),
            'stdout': result.stdout,
        }

    except subprocess.TimeoutExpired:
        return {
            'error': 'Evaluation timeout (>2 hours)',
            'success': False
        }
    except Exception as e:
        return {
            'error': f'Evaluation error: {str(e)}',
            'success': False
        }


def _run_evaluation_legacy(predictions_path, predictions, temp_dir, output_path):
    """Fallback for older swebench versions."""
    cmd = [
        sys.executable, '-m', 'swebench.harness.run_evaluation',
        '--predictions_path', predictions_path,
        '--swe_bench_tasks', 'princeton-nlp/SWE-bench_Lite',
        '--log_dir', str(temp_dir / 'logs'),
        '--testbed', str(temp_dir / 'testbed'),
        '--skip_existing', 'False',
        '--timeout', '900',
        '--num_workers', '1'
    ]

    print(f"Trying legacy API: {' '.join(cmd[:8])}...", file=sys.stderr)
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=7200)

    if result.returncode != 0:
        return {
            'error': f'Legacy evaluation failed: {result.stderr}',
            'success': False,
        }

    results_file = temp_dir / 'logs' / 'results.json'
    if results_file.exists():
        with open(results_file, 'r') as f:
            results = json.load(f)
        if output_path:
            with open(output_path, 'w') as f:
                json.dump(results, f, indent=2)
        return {'success': True, 'results': results, 'predictions_count': len(predictions)}

    return {'error': 'No results found', 'success': False}


def _find_evaluation_results(report_dir, temp_dir, run_id):
    """Search for evaluation result files."""
    # Check common output locations
    for pattern in ['**/*.json', '**/*results*.json', '**/*report*.json']:
        for d in [report_dir, temp_dir]:
            found = list(d.glob(pattern))
            if found:
                try:
                    with open(found[0], 'r') as f:
                        return json.load(f)
                except Exception:
                    continue
    return None


def _parse_stdout_results(stdout, predictions):
    """Parse evaluation results from stdout output."""
    results = []
    for pred in predictions:
        instance_id = pred['instance_id']
        model = pred.get('model_name_or_path', 'unknown')
        # Check if stdout mentions this instance as resolved
        resolved = f'{instance_id}' in stdout and ('PASS' in stdout or 'resolved' in stdout.lower())
        results.append({
            'instance_id': instance_id,
            'model_name_or_path': model,
            'resolved': resolved,
        })
    return results

def evaluate_single_task(instance_id: str, patch: str, task_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Evaluate a single task prediction.

    Args:
        instance_id: Task instance ID
        patch: Generated patch
        task_data: Task metadata from SWE-bench dataset

    Returns:
        Evaluation result for this task
    """
    # This is a simplified single-task evaluator
    # For full evaluation, use run_evaluation()

    temp_dir = Path('/tmp') / f'swebench_{instance_id}'
    temp_dir.mkdir(exist_ok=True)

    # Write prediction to file
    prediction = {
        'instance_id': instance_id,
        'model_patch': patch,
        'model_name_or_path': 'claude-orchestrator'
    }

    pred_file = temp_dir / 'prediction.json'
    with open(pred_file, 'w') as f:
        json.dump([prediction], f)

    # Run evaluation
    return run_evaluation(str(pred_file))

def main():
    """Main entry point for CLI usage."""
    if len(sys.argv) < 2:
        print(json.dumps({
            'error': 'Usage: evaluate.py <predictions.json> [output.json]',
            'success': False
        }))
        sys.exit(1)

    predictions_path = sys.argv[1]
    output_path = sys.argv[2] if len(sys.argv) > 2 else None

    # Run evaluation
    result = run_evaluation(predictions_path, output_path)

    # Output as JSON to stdout
    print(json.dumps(result, indent=2))

    # Exit with error code if evaluation failed
    if not result.get('success', False):
        sys.exit(1)

if __name__ == '__main__':
    main()
