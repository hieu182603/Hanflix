import tempfile
import unittest
import wave
from pathlib import Path
from unittest.mock import patch
from src.main import separate_vocals


def wav(path, rate=44100):
    with wave.open(str(path), 'wb') as audio:
        audio.setnchannels(2)
        audio.setsampwidth(2)
        audio.setframerate(rate)
        audio.writeframes(b'\0' * 400)


class MediaContractTests(unittest.TestCase):
    def test_rejects_16khz_demucs_input_before_spawning(self):
        with tempfile.TemporaryDirectory() as temp:
            source = Path(temp) / 'source.wav'
            wav(source, 16000)
            with patch('src.main.subprocess.run') as run:
                with self.assertRaisesRegex(ValueError, '44100'):
                    separate_vocals(source, Path(temp) / 'out.wav')
                run.assert_not_called()

    def test_demucs_command_output_validation_and_exit_propagation(self):
        with tempfile.TemporaryDirectory() as temp:
            source, output = Path(temp) / 'source.wav', Path(temp) / 'out.wav'
            wav(source)
            def generate(command, **kwargs):
                self.assertIn('--two-stems=vocals', command)
                self.assertIn('cpu', command)
                self.assertEqual(kwargs['timeout'], 840)
                self.assertNotIn('shell', kwargs)
                target = Path(command[command.index('-o') + 1]) / 'htdemucs' / 'source'
                target.mkdir(parents=True)
                wav(target / 'vocals.wav')
            with patch('src.main.subprocess.run', side_effect=generate):
                separate_vocals(source, output)
            self.assertGreater(output.stat().st_size, 44)
            with patch('src.main.subprocess.run', side_effect=RuntimeError('model failed')):
                with self.assertRaisesRegex(RuntimeError, 'model failed'):
                    separate_vocals(source, output)

    def test_missing_input_is_not_success(self):
        with self.assertRaisesRegex(ValueError, 'MEDIA_INPUT_INVALID'):
            separate_vocals(Path('missing.wav'), Path('output.wav'))


if __name__ == '__main__':
    unittest.main()
