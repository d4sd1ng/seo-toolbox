import { crawlerPlugin } from "module-crawler";
import { gscPlugin } from "module-gsc";
import { onPagePlugin } from "module-onpage";
import {
  backlinksPlugin,
  briefPlugin,
  ranksPlugin,
  researchPlugin,
} from "module-intel";
import { pageSpeedPlugin } from "module-pagespeed";
import { registerPlugin } from "plugin-sdk";

let booted = false;

export function bootPlugins() {
  if (booted) return;
  registerPlugin(onPagePlugin);
  registerPlugin(gscPlugin);
  registerPlugin(crawlerPlugin);
  registerPlugin(pageSpeedPlugin);
  registerPlugin(researchPlugin);
  registerPlugin(ranksPlugin);
  registerPlugin(briefPlugin);
  registerPlugin(backlinksPlugin);
  booted = true;
}
