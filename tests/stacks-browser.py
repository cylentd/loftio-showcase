"""Interaction smoke test against the shared devserver build."""
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
        page.keyboard.press("Escape")
        page.locator("#grove-intro").wait_for(state="detached")
        page.evaluate("__grove.pauseTicker(); if(document.querySelector('#settings-wander').checked)document.querySelector('#settings-wander').click()")
        def snapshot():
            return page.evaluate("__grove.snapshot()")
        def pose(who, x, y):
            page.evaluate("a=>__grove.poseResident(...a)", [who, x, y])
        def fixture():
            page.get_by_role("button", name="Everyone home", exact=True, include_hidden=True).evaluate("b=>b.click()")
            for i, who in enumerate(["puff", "hoodie", "chomper", "slime", "burger"]):
                pose(who, 450 + i * 200, 400)
            pose("sprout", 1100, 930)
        def stack(who, onto):
            portrait = page.evaluate("document.querySelector('#grove').dataset.room === 'portrait'")
            frame = snapshot()["frame"]
            source_x = (195 + frame["left"]) / frame["scale"] + 100 if portrait else 1450
            pose(who, source_x, 930)
            button = page.get_by_role("button", name=who.capitalize(), exact=True)
            box = button.bounding_box()
            x, y = box["x"] + box["width"] / 2, box["y"] + box["height"] / 2
            before = next(r for r in snapshot()["residents"] if r["id"] == who)
            page.mouse.move(x, y); page.mouse.down(); page.mouse.move(x + 10, y)
            held = page.evaluate("id=>__grove.residentPose(id)", who)
            target = next(r for r in snapshot()["residents"] if r["id"] == onto)
            support = page.evaluate("id=>__grove.residentPose(id)", onto)
            scale = snapshot()["frame"]["scale"]
            desired_y = target["y"] - support["lift"] - target["height"] * 0.74 + held["lift"]
            page.mouse.move(x + (target["x"] - before["x"]) * scale, y + (desired_y - before["y"]) * scale)
            page.wait_for_timeout(160)
            page.mouse.up()
        fixture(); stack("puff", "sprout")
        assert snapshot()["fidget"]["stacks"] == [["sprout", "puff"]]
        stack("hoodie", "puff")
        assert snapshot()["fidget"]["stacks"] == [["sprout", "puff", "hoodie"]]
        page.evaluate("__grove.advanceFrames(50)")
        poses = page.evaluate("['sprout','puff','hoodie'].map(id=>__grove.residentPose(id))")
        assert len({p["ground"]["y"] for p in poses}) == 1
        assert poses[0]["lift"] == 0 < poses[1]["lift"] < poses[2]["lift"]
        assert poses[1]["shadow"]["alpha"] == poses[2]["shadow"]["alpha"] == 0
        page.screenshot(path=str(Path(gettempdir()) / "loftio-stack.png"))
        pose("chomper", 1200, 930)
        fourth = page.get_by_role("button", name="Chomper", exact=True)
        fourth.focus(); page.keyboard.press("Space"); page.keyboard.press("s")
        assert snapshot()["fidget"]["stacks"] == [["sprout", "puff", "hoodie", "chomper"]]
        page.keyboard.press("Space")
        assert snapshot()["fidget"]["stacks"] == [["sprout", "puff", "hoodie"]]
        page.keyboard.press("Escape")
        page.emulate_media(reduced_motion="reduce"); page.evaluate("__grove.advanceFrames(10)")
        assert snapshot()["fidget"]["stacks"] == [["sprout", "puff", "hoodie"]]
        page.emulate_media(reduced_motion="no-preference")
        middle = page.get_by_role("button", name="Puff", exact=True)
        middle.focus(); page.keyboard.press("Space")
        assert not snapshot()["fidget"]["stacks"]
        assert any(f["id"] == "hoodie" for f in snapshot()["fidget"]["flights"])
        assert not next(r for r in snapshot()["residents"] if r["id"] == "sprout")["held"]
        page.keyboard.press("Escape"); page.evaluate("__grove.advanceFrames(500)")
        assert not snapshot()["fidget"]["flights"]
        fixture(); stack("puff", "sprout"); stack("hoodie", "puff")
        pose("chomper", 960, 940)
        fourth.focus(); page.keyboard.press("Space"); page.keyboard.press("Enter")
        page.evaluate("__grove.advanceFrames(35)")
        assert not snapshot()["fidget"]["stacks"], "a direct base hit should topple the pile"
        page.evaluate("__grove.advanceFrames(500)")
        assert not snapshot()["fidget"]["flights"]
        assert all(not r["held"] for r in snapshot()["residents"])
        # The full cast fits after camera easing, and is still individually reachable.
        fixture()
        normal_scale = snapshot()["frame"]["scale"]
        members = ["sprout", "puff", "hoodie", "chomper", "slime", "burger"]
        for who, onto in zip(members[1:], members):
            stack(who, onto)
            page.evaluate("__grove.advanceFrames(120)")
        assert snapshot()["fidget"]["stacks"] == [members]
        assert snapshot()["frame"]["scale"] < normal_scale
        for who in members:
            box = page.get_by_role("button", name=who.capitalize(), exact=True).bounding_box()
            assert box["y"] >= 0 and box["y"] + box["height"] <= 900, (who, box)
        page.screenshot(path=str(Path(gettempdir()) / "loftio-six-stack.png"))
        # Changing paintings resets arrangements; a new portrait pile must fit too.
        page.set_viewport_size({"width": 390, "height": 844})
        page.wait_for_function("document.querySelector('#grove').dataset.room === 'portrait'")
        page.evaluate("__grove.pauseTicker()")
        assert not snapshot()["fidget"]["stacks"]
        assert not snapshot()["fidget"]["flights"]
        frame = snapshot()["frame"]
        portrait_normal_scale = frame["scale"]
        center = (195 + frame["left"]) / frame["scale"]
        for who in members[1:]:
            pose(who, 400, 300)
        pose("sprout", center - 60, 930)
        for who, onto in zip(members[1:], members):
            stack(who, onto)
            page.evaluate("__grove.advanceFrames(120)")
        assert snapshot()["fidget"]["stacks"] == [members]
        page.evaluate("__grove.advanceFrames(150)")
        for who in members:
            box = page.get_by_role("button", name=who.capitalize(), exact=True).bounding_box()
            assert box["y"] >= 0 and box["y"] + box["height"] <= 844, (who, box)
        page.screenshot(path=str(Path(gettempdir()) / "loftio-six-stack-phone.png"))
        # Camera framing is locked during an actual grab.
        button = page.get_by_role("button", name="Burger", exact=True)
        button.focus(); page.keyboard.press("Space")
        held_frame = snapshot()["frame"]
        page.evaluate("__grove.advanceFrames(50)")
        assert snapshot()["frame"] == held_frame
        page.keyboard.press("Escape")
        page.get_by_role("button", name="Everyone home", exact=True, include_hidden=True).evaluate("b=>b.click()")
        page.evaluate("__grove.advanceFrames(150)")
        assert not snapshot()["fidget"]["stacks"]
        assert abs(snapshot()["frame"]["scale"] - portrait_normal_scale) < 0.001, "reset must restore the portrait room's normal scale"
        assert not errors, errors
        print("PASS: pointer/keyboard stacking, all six, shared depth, Still, middle removal, toppling, settling, desktop/phone framing, grab camera lock, reset framing")
    finally:
        browser.close()
