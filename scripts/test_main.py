#!/usr/bin/env python3
"""Tests for main.py — no real terminal, no real modules needed."""

import json
import sys
import tempfile
import unittest
from datetime import date, timedelta
from pathlib import Path
from unittest.mock import MagicMock, patch, call

# ── Import main.py functions without executing __main__ ───────────────────────
SCRIPT_DIR = Path(__file__).parent
sys.path.insert(0, str(SCRIPT_DIR))

# Patch termios/tty at import time (not available in non-tty environments)
import unittest.mock
sys.modules.setdefault("termios", unittest.mock.MagicMock())
sys.modules.setdefault("tty", unittest.mock.MagicMock())

import importlib.util
spec = importlib.util.spec_from_file_location("main", SCRIPT_DIR / "main.py")
main_mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(main_mod)


# ── Helpers ───────────────────────────────────────────────────────────────────

def iso(days_ago: int) -> str:
    return str(date.today() - timedelta(days=days_ago))

TODAY = iso(0)
YESTERDAY = iso(1)


# ═════════════════════════════════════════════════════════════════════════════
# 1. compute_streak
# ═════════════════════════════════════════════════════════════════════════════

class TestComputeStreak(unittest.TestCase):

    def test_empty(self):
        self.assertEqual(main_mod.compute_streak([]), 0)

    def test_only_today(self):
        self.assertEqual(main_mod.compute_streak([TODAY]), 1)

    def test_only_yesterday(self):
        self.assertEqual(main_mod.compute_streak([YESTERDAY]), 1)

    def test_today_and_yesterday(self):
        self.assertEqual(main_mod.compute_streak([TODAY, YESTERDAY]), 2)

    def test_seven_consecutive_ending_today(self):
        dates = [iso(i) for i in range(7)]
        self.assertEqual(main_mod.compute_streak(dates), 7)

    def test_seven_consecutive_ending_yesterday(self):
        dates = [iso(i) for i in range(1, 8)]
        self.assertEqual(main_mod.compute_streak(dates), 7)

    def test_gap_breaks_streak(self):
        # today + 3 days ago (gap on day 1 and 2) — streak = 1
        dates = [TODAY, iso(3)]
        self.assertEqual(main_mod.compute_streak(dates), 1)

    def test_duplicates_ignored(self):
        dates = [TODAY, TODAY, YESTERDAY, YESTERDAY]
        self.assertEqual(main_mod.compute_streak(dates), 2)

    def test_old_dates_dont_count(self):
        # Streak of 2 recent + old history that has a gap
        dates = [TODAY, YESTERDAY, iso(5), iso(6), iso(7)]
        self.assertEqual(main_mod.compute_streak(dates), 2)

    def test_single_day_two_days_ago(self):
        # two days ago with no yesterday/today → streak broken
        self.assertEqual(main_mod.compute_streak([iso(2)]), 0)


# ═════════════════════════════════════════════════════════════════════════════
# 2. last_logged
# ═════════════════════════════════════════════════════════════════════════════

class TestLastLogged(unittest.TestCase):

    def test_empty(self):
        self.assertEqual(main_mod.last_logged([]), "never")

    def test_today(self):
        self.assertEqual(main_mod.last_logged([TODAY]), "today")

    def test_yesterday(self):
        self.assertEqual(main_mod.last_logged([YESTERDAY]), "yesterday")

    def test_older_returns_iso(self):
        old = iso(10)
        self.assertEqual(main_mod.last_logged([old]), old)

    def test_picks_latest(self):
        self.assertEqual(main_mod.last_logged([YESTERDAY, TODAY, iso(5)]), "today")


# ═════════════════════════════════════════════════════════════════════════════
# 3. already_logged_today
# ═════════════════════════════════════════════════════════════════════════════

class TestAlreadyLoggedToday(unittest.TestCase):

    def test_not_logged(self):
        self.assertFalse(main_mod.already_logged_today([]))

    def test_logged_today(self):
        self.assertTrue(main_mod.already_logged_today([TODAY]))

    def test_only_yesterday(self):
        self.assertFalse(main_mod.already_logged_today([YESTERDAY]))


# ═════════════════════════════════════════════════════════════════════════════
# 4. load_monk_log / save_monk_log
# ═════════════════════════════════════════════════════════════════════════════

class TestMonkLogIO(unittest.TestCase):

    def setUp(self):
        self.tmp = tempfile.NamedTemporaryFile(suffix=".json", delete=False)
        self.tmp.close()
        self.orig_path = main_mod.MONK_LOG
        main_mod.MONK_LOG = Path(self.tmp.name)

    def tearDown(self):
        main_mod.MONK_LOG = self.orig_path
        Path(self.tmp.name).unlink(missing_ok=True)

    def test_load_missing_returns_empty(self):
        Path(self.tmp.name).unlink()
        result = main_mod.load_monk_log()
        self.assertEqual(result, {"dates": []})

    def test_roundtrip(self):
        payload = {"dates": [TODAY, YESTERDAY]}
        main_mod.save_monk_log(payload)
        loaded = main_mod.load_monk_log()
        self.assertEqual(loaded, payload)

    def test_save_writes_valid_json(self):
        main_mod.save_monk_log({"dates": [TODAY]})
        with open(self.tmp.name) as f:
            data = json.load(f)
        self.assertIn(TODAY, data["dates"])

    def test_duplicate_not_added_twice(self):
        """Simulates monk_menu logic: only append if not already present."""
        main_mod.save_monk_log({"dates": [TODAY]})
        log = main_mod.load_monk_log()
        dates = log["dates"]
        if TODAY not in dates:
            dates.append(TODAY)
        log["dates"] = dates
        main_mod.save_monk_log(log)
        loaded = main_mod.load_monk_log()
        self.assertEqual(loaded["dates"].count(TODAY), 1)


# ═════════════════════════════════════════════════════════════════════════════
# 5. _run_module — importlib dispatch
# ═════════════════════════════════════════════════════════════════════════════

class TestRunModule(unittest.TestCase):

    def test_calls_main_on_loaded_module(self):
        fake_mod = MagicMock()
        fake_spec = MagicMock()
        fake_spec.loader.exec_module = MagicMock()

        with patch("importlib.util.spec_from_file_location", return_value=fake_spec), \
             patch("importlib.util.module_from_spec", return_value=fake_mod):
            main_mod._run_module("flashcard")

        fake_mod.main.assert_called_once()

    def test_passes_correct_path(self):
        fake_mod = MagicMock()
        fake_spec = MagicMock()
        captured = {}

        def capture_spec(name, path):
            captured["name"] = name
            captured["path"] = path
            return fake_spec

        with patch("importlib.util.spec_from_file_location", side_effect=capture_spec), \
             patch("importlib.util.module_from_spec", return_value=fake_mod):
            main_mod._run_module("listening")

        self.assertEqual(captured["name"], "listening")
        self.assertTrue(str(captured["path"]).endswith("listening.py"))


# ═════════════════════════════════════════════════════════════════════════════
# 6. study_menu — key dispatch (no real terminal)
# ═════════════════════════════════════════════════════════════════════════════

class TestStudyMenuDispatch(unittest.TestCase):
    """Drive study_menu() with mocked getch() to verify each key calls the right thing."""

    def _run_with_keys(self, keys, run_module_mock, coming_soon_mock=None):
        """Feed keys then 'B' to exit the loop."""
        key_iter = iter(keys + ["B"])
        with patch.object(main_mod, "getch", side_effect=lambda: next(key_iter)), \
             patch.object(main_mod, "clear"), \
             patch.object(main_mod, "_run_module", run_module_mock), \
             patch.object(main_mod, "_coming_soon", coming_soon_mock or MagicMock()):
            main_mod.study_menu()

    def test_key_1_calls_listening(self):
        m = MagicMock()
        self._run_with_keys(["1"], m)
        m.assert_called_once_with("listening")

    def test_key_2_calls_flashcard(self):
        m = MagicMock()
        self._run_with_keys(["2"], m)
        m.assert_called_once_with("flashcard")

    def test_key_s_calls_sync_vocab(self):
        m = MagicMock()
        self._run_with_keys(["s"], m)
        m.assert_called_once_with("sync_vocab")

    def test_key_r_calls_generate_vocab(self):
        m = MagicMock()
        self._run_with_keys(["r"], m)
        m.assert_called_once_with("generate_vocab")

    def test_key_3_calls_coming_soon(self):
        run_m = MagicMock()
        cs_m = MagicMock()
        self._run_with_keys(["3"], run_m, cs_m)
        cs_m.assert_called_once()
        run_m.assert_not_called()

    def test_key_4_calls_coming_soon(self):
        run_m = MagicMock()
        cs_m = MagicMock()
        self._run_with_keys(["4"], run_m, cs_m)
        cs_m.assert_called_once()

    def test_key_5_calls_coming_soon(self):
        run_m = MagicMock()
        cs_m = MagicMock()
        self._run_with_keys(["5"], run_m, cs_m)
        cs_m.assert_called_once()

    def test_key_b_returns(self):
        """Pressing B immediately exits without calling anything."""
        m = MagicMock()
        self._run_with_keys([], m)  # empty → immediately hits B
        m.assert_not_called()

    def test_key_q_exits(self):
        with patch.object(main_mod, "getch", return_value="q"), \
             patch.object(main_mod, "clear"), \
             patch.object(main_mod, "_run_module"), \
             self.assertRaises(SystemExit):
            main_mod.study_menu()


# ═════════════════════════════════════════════════════════════════════════════
# 7. monk_menu — ritual completion flow
# ═════════════════════════════════════════════════════════════════════════════

class TestMonkMenuFlow(unittest.TestCase):

    def setUp(self):
        self.tmp = tempfile.NamedTemporaryFile(suffix=".json", delete=False)
        self.tmp.close()
        Path(self.tmp.name).write_text(json.dumps({"dates": []}))
        self.orig_path = main_mod.MONK_LOG
        main_mod.MONK_LOG = Path(self.tmp.name)

    def tearDown(self):
        main_mod.MONK_LOG = self.orig_path
        Path(self.tmp.name).unlink(missing_ok=True)

    def test_begin_ritual_logs_today(self):
        """Pressing B triggers ritual; after completion today is in monk_log."""
        key_iter = iter(["b", "\x1b"])  # B = begin, then ESC = back
        with patch.object(main_mod, "getch", side_effect=lambda: next(key_iter)), \
             patch.object(main_mod, "clear"), \
             patch.object(main_mod, "_run_ritual", return_value=(True, True)), \
             patch.object(main_mod, "_show_streak_update"):
            main_mod.monk_menu()

        log = main_mod.load_monk_log()
        self.assertIn(TODAY, log["dates"])

    def test_already_logged_today_skips_ritual(self):
        """If today already logged, pressing B should just go back (done_today branch)."""
        Path(self.tmp.name).write_text(json.dumps({"dates": [TODAY]}))
        key_iter = iter(["b"])  # B with done_today=True → return
        ritual_mock = MagicMock()
        with patch.object(main_mod, "getch", side_effect=lambda: next(key_iter)), \
             patch.object(main_mod, "clear"), \
             patch.object(main_mod, "_run_ritual", ritual_mock):
            main_mod.monk_menu()
        ritual_mock.assert_not_called()

    def test_streak_zero_on_fresh_log(self):
        """Fresh log → compute_streak returns 0."""
        self.assertEqual(main_mod.compute_streak([]), 0)

    def test_ritual_completion_updates_streak_display(self):
        """After ritual, streak screen is shown with correct streak."""
        key_iter = iter(["b", "\x1b"])
        streak_mock = MagicMock()
        with patch.object(main_mod, "getch", side_effect=lambda: next(key_iter)), \
             patch.object(main_mod, "clear"), \
             patch.object(main_mod, "_run_ritual", return_value=(True, True)), \
             patch.object(main_mod, "_show_streak_update", streak_mock):
            main_mod.monk_menu()
        streak_mock.assert_called_once_with(1)  # first day → streak 1

    def test_duplicate_date_not_added(self):
        """Running ritual when today already in log doesn't duplicate it."""
        Path(self.tmp.name).write_text(json.dumps({"dates": [TODAY]}))
        # Manually invoke the log logic as monk_menu would
        log = main_mod.load_monk_log()
        dates = log["dates"]
        if TODAY not in dates:
            dates.append(TODAY)
        log["dates"] = dates
        main_mod.save_monk_log(log)
        loaded = main_mod.load_monk_log()
        self.assertEqual(loaded["dates"].count(TODAY), 1)


# ═════════════════════════════════════════════════════════════════════════════
# 8. root_menu — top-level routing
# ═════════════════════════════════════════════════════════════════════════════

class TestRootMenu(unittest.TestCase):

    def test_s_calls_study_menu(self):
        key_iter = iter(["s", "q"])
        study_mock = MagicMock()
        with patch.object(main_mod, "getch", side_effect=lambda: next(key_iter)), \
             patch.object(main_mod, "clear"), \
             patch.object(main_mod, "study_menu", study_mock), \
             self.assertRaises(SystemExit):
            main_mod.root_menu()
        study_mock.assert_called_once()

    def test_m_calls_monk_menu(self):
        key_iter = iter(["m", "q"])
        monk_mock = MagicMock()
        with patch.object(main_mod, "getch", side_effect=lambda: next(key_iter)), \
             patch.object(main_mod, "clear"), \
             patch.object(main_mod, "monk_menu", monk_mock), \
             self.assertRaises(SystemExit):
            main_mod.root_menu()
        monk_mock.assert_called_once()

    def test_q_exits(self):
        with patch.object(main_mod, "getch", return_value="q"), \
             patch.object(main_mod, "clear"), \
             self.assertRaises(SystemExit):
            main_mod.root_menu()

    def test_ctrl_c_exits(self):
        with patch.object(main_mod, "getch", return_value="\x03"), \
             patch.object(main_mod, "clear"), \
             self.assertRaises(SystemExit):
            main_mod.root_menu()


# ═════════════════════════════════════════════════════════════════════════════
# Runner
# ═════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    loader = unittest.TestLoader()
    suite = unittest.TestSuite()

    suites = [
        TestComputeStreak,
        TestLastLogged,
        TestAlreadyLoggedToday,
        TestMonkLogIO,
        TestRunModule,
        TestStudyMenuDispatch,
        TestMonkMenuFlow,
        TestRootMenu,
    ]
    for cls in suites:
        suite.addTests(loader.loadTestsFromTestCase(cls))

    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    sys.exit(0 if result.wasSuccessful() else 1)
