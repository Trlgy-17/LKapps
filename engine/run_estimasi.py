"""Titik masuk CLI: python run_estimasi.py < masukan.json > keluaran.json"""
import sys

from estimasi_engine.cli import main

sys.exit(main())
