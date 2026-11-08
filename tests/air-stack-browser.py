"""Real upward flicks land on standing residents and existing piles."""
from pathlib import Path
from tempfile import gettempdir
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    try:
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.goto("http://localhost:8000/loftio-fidget/?debug")
        page.wait_for_function("window.__grove && document.querySelector('#grove').getAttribute('aria-busy') === 'false'")
        page.keyboard.press("Escape"); page.locator("#grove-intro").wait_for(state="detached")
        page.evaluate("__grove.pauseTicker(); if(document.querySelector('#settings-wander').checked)document.querySelector('#settings-wander').click()")
        def state():
            return page.evaluate("__grove.snapshot()")
        def pose(who, x, y):
            page.evaluate("a=>__grove.poseResident(...a)", [who, x, y])
        for i, who in enumerate(["puff", "hoodie", "chomper", "slime", "burger"]):
            pose(who, 450 + i * 200, 400)
        pose("sprout", 1250, 800)
        def toss(who):
            pose(who, 1250, 990)
            button = page.get_by_role("button", name=who.capitalize(), exact=True)
            box = button.bounding_box()
            x, y = box["x"] + box["width"] / 2, box["y"] + box["height"] / 2
            page.mouse.move(x, y); page.mouse.down()
            page.mouse.move(x, y - 30); page.mouse.move(x, y - 90); page.mouse.up()
            assert any(f["id"] == who and f["vz"] > 800 for f in state()["fidget"]["flights"]), "upward gesture did not launch"
            page.evaluate("__grove.advanceFrames(20)")
            assert not any(who in pile for pile in state()["fidget"]["stacks"]), "resident stuck while rising"
            page.evaluate("__grove.advanceFrames(90)")
        toss("puff")
        assert state()["fidget"]["stacks"] == [["sprout", "puff"]], state()["fidget"]
        toss("hoodie")
        assert state()["fidget"]["stacks"] == [["sprout", "puff", "hoodie"]], state()["fidget"]
        assert not state()["fidget"]["flights"]
        page.screenshot(path=str(Path(gettempdir()) / "loftio-air-stack.png"))
        assert not errors, errors
        print("PASS: actual upward flick, no rising attachment, descending catch, landing on an existing pile, settled flight cleanup")
    finally:
        browser.close()
