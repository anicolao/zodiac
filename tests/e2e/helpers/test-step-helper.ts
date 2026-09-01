import { expect, type Page, type TestInfo } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

interface Verification {
  spec: string;
  check: () => Promise<void>;
}

interface DocStep {
  title: string;
  image: string;
  specs: string[];
}

export class TestStepHelper {
  private count = 0;
  private steps: DocStep[] = [];
  private title = '';
  private description = '';

  constructor(
    private page: Page,
    private testInfo: TestInfo
  ) {}

  setMetadata(title: string, description: string) {
    this.title = title;
    this.description = description;
  }

  async step(id: string, options: { description: string; verifications: Verification[] }) {
    for (const verification of options.verifications) await verification.check();
    await expect(this.page.locator('[data-status]')).toHaveAttribute('data-status', 'ready');
    await this.page.mouse.move(0, 0);
    await this.page.evaluate(() => {
      const controls = Array.from(
        document.querySelectorAll<HTMLElement>('button, input, label.shutter')
      ).filter((element) => {
        const box = element.getBoundingClientRect();
        return box.width > 0 && box.height > 0 && getComputedStyle(element).visibility !== 'hidden';
      });
      for (const control of controls) {
        const box = control.getBoundingClientRect();
        if (box.width < 44 || box.height < 44) {
          throw new Error(`${control.tagName} is smaller than the 44-pixel touch target`);
        }
      }
    });

    const index = String(this.count++).padStart(3, '0');
    const platform = process.platform === 'linux' ? '-linux' : '';
    const filename = `${index}-${id}-${this.testInfo.project.name}${platform}.png`;
    await expect(this.page).toHaveScreenshot(filename);
    this.steps.push({
      title: options.description,
      image: `./screenshots/${filename}`,
      specs: options.verifications.map(({ spec }) => spec)
    });
  }

  generateDocs() {
    if (this.testInfo.project.name !== 'phone' || process.platform === 'linux') return;
    let content = `# ${this.title}\n\n${this.description}\n\n`;
    for (const step of this.steps) {
      content += `## ${step.title}\n\n![${step.title}](${step.image})\n\n`;
      content += `**Verifications:**\n\n${step.specs.map((spec) => `- [x] ${spec}`).join('\n')}\n\n`;
    }
    fs.writeFileSync(path.join(path.dirname(this.testInfo.file), 'README.md'), `${content.trimEnd()}\n`);
  }
}
