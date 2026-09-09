import subprocess
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
RELEASE_SCRIPTS = (
    REPO_ROOT / "scripts" / "release-deb.sh",
    REPO_ROOT / "scripts" / "release-macos.sh",
)
RELEASE_WORKFLOW = REPO_ROOT / ".github" / "workflows" / "release-packages.yml"
MANIFEST_SCRIPT = REPO_ROOT / "scripts" / "generate-update-manifest.mjs"


class CommunityReleaseContractTests(unittest.TestCase):
    def test_release_scripts_are_valid_bash(self):
        for script in RELEASE_SCRIPTS:
            with self.subTest(script=script.name):
                subprocess.run(["bash", "-n", str(script)], check=True)

    def test_release_scripts_only_publish_to_github(self):
        for script in RELEASE_SCRIPTS:
            source = script.read_text(encoding="utf-8")
            with self.subTest(script=script.name):
                self.assertIn('gh release view "$TAG"', source)
                self.assertIn('gh release upload "$TAG"', source)
                self.assertIn("-community", source)
                self.assertNotIn("ssh ", source)
                self.assertNotIn("rsync ", source)
                self.assertNotIn("pinvou.com", source)

    def test_release_workflow_publishes_the_update_manifest(self):
        workflow = RELEASE_WORKFLOW.read_text(encoding="utf-8")
        self.assertIn("publish-release:", workflow)
        self.assertIn("contents: write", workflow)
        self.assertIn("scripts/generate-update-manifest.mjs", workflow)
        self.assertIn('gh release create "$TAG" release-assets/*', workflow)
        self.assertIn('gh release upload "$TAG" release-assets/* --clobber', workflow)

    def test_manifest_generator_uses_fresh_agent_release_urls(self):
        source = MANIFEST_SCRIPT.read_text(encoding="utf-8")
        self.assertIn("https://github.com/${repository}/releases/download/", source)
        self.assertNotIn("pinvou.com", source)


if __name__ == "__main__":
    unittest.main()
