"""Run against the shared devserver build: python tests/lobby-fidget-browser.py."""
from pathlib import Path
from tempfile import gettempdir
from playwright.sync_api import sync_playwright

URL = "http://localhost:8000/loftio-fidget/?debug"
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    try:
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.goto(URL)
        page.wait_for_function("window.__grove")
        # Streaming ambience need not finish downloading before the room is ready.
        page.wait_for_function("document.querySelector('#grove').getAttribute('aria-busy') === 'false'")
        page.keyboard.press("Escape")
        page.locator("#grove-intro").wait_for(state="detached")
        page.evaluate("__grove.pauseTicker()")
        page.evaluate("__grove.poseResident('puff',1000,850)")
        resident = page.get_by_role("button", name="Puff", exact=True)
        def snapshot():
            return page.evaluate("__grove.snapshot()")
        def grab():
            box = resident.bounding_box()
            x, y = box["x"] + box["width"] / 2, box["y"] + box["height"] / 2
            page.mouse.move(x, y)
            page.mouse.down()
            return x, y
        # Pull deformation is visible immediately while feet track the pointer.
        x, y = grab()
        page.mouse.move(x + 40, y)
        pulled = page.evaluate("__grove.residentPose('puff')")
        assert pulled["renderedHeight"] < pulled["height"], "horizontal pull must compress the resident vertically"
        page.wait_for_timeout(150)
        page.mouse.up()
        page.evaluate("__grove.poseResident('puff',1000,850)")
        # Real fast pointer release launches the resident.
        x, y = grab()
        page.mouse.move(x + 40, y - 30)
        page.mouse.move(x + 180, y - 120)
        page.mouse.up()
        assert [f["id"] for f in snapshot()["fidget"]["flights"]] == ["puff"], "fast drag did not throw the targeted resident"
        page.evaluate("__grove.advanceFrames(12)")
        flight = snapshot()["fidget"]["flights"][0]
        pose = page.evaluate("__grove.residentPose('puff')")
        assert flight["z"] > 0 and flight["y"] >= 725
        assert pose["shadow"]["y"] == flight["y"] == pose["ground"]["y"], "shadow must stay on the floor during hops"
        assert abs(pose["lift"] - flight["z"]) < 0.01
        assert abs(pose["rotation"]) <= 0.2, "floor play should lean, not spin like a screen-space ball"
        # Catch and release without moving cannot leave a resident held forever.
        page.screenshot(path=str(Path(gettempdir()) / "loftio-lobby-catch.png"))
        before_catch = page.evaluate("__grove.residentPose('puff')")
        grab()
        caught = page.evaluate("__grove.residentPose('puff')")
        assert abs(caught["lift"] - before_catch["lift"]) < 0.01, "catch must preserve the visible height"
        assert caught["renderedHeight"] / caught["height"] < 0.9, "catch squish must be immediate"
        page.mouse.up()
        assert not snapshot()["fidget"]["flights"]
        assert not next(r for r in snapshot()["residents"] if r["id"] == "puff")["held"]
        # Moving then pausing is placement, not a stale throw.
        page.evaluate("__grove.poseResident('puff',1000,850)")
        x, y = grab()
        page.mouse.move(x + 100, y)
        page.wait_for_timeout(150)
        page.mouse.up()
        assert not snapshot()["fidget"]["flights"]
        # Keyboard parity and a naturally completed flight.
        resident.focus()
        page.keyboard.press("Space")
        page.keyboard.press("Enter")
        assert len(snapshot()["fidget"]["flights"]) == 1
        page.evaluate("__grove.advanceFrames(8)")
        x, y = grab()
        page.mouse.move(x + 30, y)
        page.mouse.move(x + 100, y)
        page.mouse.up()
        assert any(f["id"] == "puff" and f["vx"] > 0 for f in snapshot()["fidget"]["flights"]), "catch and re-fling must not need a cooldown"
        page.evaluate("__grove.advanceFrames(1200)")
        assert not snapshot()["fidget"]["flights"], "flight failed to settle"
        assert all(not r["held"] for r in snapshot()["residents"])
        # The user removed loose objects: only the six resident hit targets remain.
        assert page.locator(".resident-hit").count() == 6
        assert page.get_by_role("button", name="Bounce the ball", exact=True).count() == 0
        assert page.get_by_role("button", name="Toss the cushion", exact=True).count() == 0
        # Depth scales the resident while its shadow stays at its feet.
        page.evaluate("__grove.poseResident('puff',1200,950)")
        resident.focus(); page.keyboard.press("Space"); page.keyboard.press("Enter")
        before = page.evaluate("__grove.residentPose('puff')")
        page.evaluate("__grove.advanceFrames(8)")
        after = page.evaluate("__grove.residentPose('puff')")
        assert after["ground"]["y"] < before["ground"]["y"]
        assert after["height"] < before["height"], "going deeper should make the resident smaller"
        page.screenshot(path=str(Path(gettempdir()) / "loftio-lobby-desktop.png"))
        # Reduced motion safely settles play and prevents another keyboard throw.
        page.emulate_media(reduced_motion="reduce")
        page.evaluate("__grove.advanceFrames(1)")
        assert snapshot()["frozen"]
        assert not snapshot()["fidget"]["flights"]
        resident.focus(); page.keyboard.press("Space"); page.keyboard.press("Enter")
        assert not snapshot()["fidget"]["flights"]
        page.keyboard.press("Escape")
        # An idle floor resident participates in a real bump; perched residents do not.
        page.emulate_media(reduced_motion="no-preference")
        page.evaluate("if(document.querySelector('#settings-wander').checked)document.querySelector('#settings-wander').click(); __grove.poseResident('puff',1200,930); __grove.poseResident('sprout',1320,930)")
        resident.focus(); page.keyboard.press("Space"); page.keyboard.press("Enter")
        page.evaluate("__grove.advanceFrames(20)")
        assert any(f["id"] == "sprout" for f in snapshot()["fidget"]["flights"]), "neighbor did not react to a bump"
        assert next(r for r in snapshot()["residents"] if r["id"] == "sprout")["x"] > 1320
        page.evaluate("__grove.advanceFrames(500)")
        assert not snapshot()["fidget"]["flights"], "bumped neighbors failed to settle"
        # A real touch drag on a narrow viewport uses the same throw contract.
        phone = browser.new_context(viewport={"width": 390, "height": 844}, has_touch=True, is_mobile=True)
        mobile = phone.new_page()
        mobile.on("pageerror", lambda error: errors.append(str(error)))
        mobile.goto(URL)
        mobile.wait_for_function("window.__grove && document.querySelector('#grove').getAttribute('aria-busy') === 'false'")
        mobile.keyboard.press("Escape")
        mobile.locator("#grove-intro").wait_for(state="detached")
        mobile.evaluate("__grove.pauseTicker(); const f=__grove.snapshot().frame; __grove.poseResident('puff',(195+f.left)/f.scale,900)")
        box = mobile.get_by_role("button", name="Puff", exact=True).bounding_box()
        x, y = box["x"] + box["width"] / 2, box["y"] + box["height"] / 2
        cdp = phone.new_cdp_session(mobile)
        cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": x, "y": y}]})
        cdp.send("Input.dispatchTouchEvent", {"type": "touchMove", "touchPoints": [{"x": x + 30, "y": y - 30}]})
        cdp.send("Input.dispatchTouchEvent", {"type": "touchMove", "touchPoints": [{"x": x + 100, "y": y - 100}]})
        cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
        assert mobile.evaluate("__grove.snapshot().fidget.flights.some(f=>f.id==='puff')"), "touch flick failed"
        mobile.evaluate("__grove.advanceFrames(8)")
        box = mobile.get_by_role("button", name="Puff", exact=True).bounding_box()
        assert box["x"] >= 0 and box["x"] + box["width"] <= 390, "phone throw left the viewport"
        mobile.screenshot(path=str(Path(gettempdir()) / "loftio-lobby-phone.png"))
        phone.close()
        assert not errors, errors
        print("PASS: pointer flick, catch, slow placement, keyboard toss, settle, no toys, grounded shadow, perspective scale, reduced motion, phone touch flick; no browser errors")
    finally:
        browser.close()
