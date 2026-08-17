import { exec } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import chalk from "chalk";

interface ComponentOptions {
  astro: boolean;
  name: string;
  noCss: boolean;
}

interface ValidationResult {
  error?: string;
  isValid: boolean;
}

const toKebabCase = (str: string): string =>
  str
    .split(/(?=[A-Z])/)
    .join("-")
    .toLowerCase();

const validateComponentName = (name: string | undefined): ValidationResult => {
  if (!name) {
    return {
      isValid: false,
      error: "Please provide a component name using NAME environment variable.",
    };
  }

  if (!/^[A-Z][a-zA-Z0-9]*$/.test(name)) {
    return {
      isValid: false,
      error:
        "Component name must start with an uppercase letter and contain only alphanumeric characters.",
    };
  }

  return { isValid: true };
};

const findParentFolder = (baseDir: string, componentName: string): string => {
  const parts = componentName.split(/(?=[A-Z])/);
  let currentDir = baseDir;
  let remainingParts = [...parts];

  while (remainingParts.length > 1) {
    const currentPart = remainingParts[0];
    const potentialDir = path.join(currentDir, currentPart);
    const kebabDir = path.join(currentDir, toKebabCase(currentPart));

    if (fs.existsSync(potentialDir)) {
      currentDir = potentialDir;
      remainingParts.shift();
    } else if (fs.existsSync(kebabDir)) {
      currentDir = kebabDir;
      remainingParts.shift();
    } else {
      const combinedParts = remainingParts.slice(0, 2).join("");
      const combinedDir = path.join(currentDir, combinedParts);
      const combinedKebabDir = path.join(
        currentDir,
        toKebabCase(combinedParts)
      );

      if (fs.existsSync(combinedDir)) {
        currentDir = combinedDir;
        remainingParts = remainingParts.slice(2);
      } else if (fs.existsSync(combinedKebabDir)) {
        currentDir = combinedKebabDir;
        remainingParts = remainingParts.slice(2);
      } else {
        break;
      }
    }
  }

  return currentDir;
};

const generateComponentContent = (
  componentName: string,
  noCss: boolean,
  astro: boolean
): string => {
  if (astro) {
    if (noCss) {
      return `<div>Hello world</div>
`;
    }

    return `---
import "./${componentName}.css";
---

<div>Hello world</div>
`;
  }

  if (noCss) {
    return `import type { IslandProps } from "@/types/island-props";

type ${componentName}Props = IslandProps;

export default function ${componentName}(_props: ${componentName}Props) {
  return (
    <div>
      Hello world
    </div>
  );
}`;
  }

  return `import type { IslandProps } from "@/types/island-props";

import "./${componentName}.css";

type ${componentName}Props = IslandProps;

export default function ${componentName}(_props: ${componentName}Props) {
  return (
    <div>
      Hello world
    </div>
  );
}`;
};

const createComponentFiles = (
  componentDir: string,
  content: string,
  noCss: boolean,
  fileName: string,
  componentName: string
): void => {
  fs.mkdirSync(componentDir, { recursive: true });

  const componentPath = path.join(componentDir, fileName);
  fs.writeFileSync(componentPath, content);

  if (!noCss) {
    const cssPath = path.join(componentDir, `${componentName}.css`);
    fs.writeFileSync(cssPath, "");
  }
};

const openFileInCursor = (filePath: string): void => {
  exec(`cursor -r "${filePath}"`, (error, _stdout, stderr) => {
    if (error || stderr) {
      console.warn(chalk.yellow("Could not open file in Cursor."));
      console.log(chalk.gray(`Created: ${filePath}`));

      return;
    }

    console.log(chalk.gray(`File opened in Cursor: ${filePath}`));
  });
};

const createComponent = (options: ComponentOptions): void => {
  const { name: componentName, noCss, astro } = options;

  const validation = validateComponentName(componentName);

  if (!validation.isValid) {
    console.error(chalk.bgRed.bold(" ERROR "), chalk.red(validation.error));
    process.exit(1);
  }

  const componentsDir = path.join(process.cwd(), "src", "components");

  if (!fs.existsSync(componentsDir)) {
    console.error(
      chalk.bgRed.bold(" ERROR "),
      chalk.red("Components directory does not exist.")
    );
    process.exit(1);
  }

  const parentDir = findParentFolder(componentsDir, componentName);
  const parts = componentName.split(/(?=[A-Z])/);
  const folderName =
    parentDir === componentsDir ? componentName : parts[parts.length - 1];
  const kebabFolderName = toKebabCase(folderName);
  const componentDir = path.join(parentDir, kebabFolderName);

  if (fs.existsSync(componentDir)) {
    console.error(
      chalk.bgRed.bold(" ERROR "),
      chalk.red(`Component "${componentName}" already exists.`)
    );
    process.exit(1);
  }

  try {
    // .astro filenames must be PascalCase — the language server derives <Name /> from the filename.
    const fileName = astro ? `${componentName}.astro` : `${componentName}.tsx`;
    const content = generateComponentContent(componentName, noCss, astro);
    createComponentFiles(componentDir, content, noCss, fileName, componentName);

    openFileInCursor(path.join(componentDir, fileName));

    console.log(
      chalk.bgGreen.bold(" SUCCESS "),
      chalk.green(`Component "${componentName}" created successfully`)
    );
    console.log(chalk.gray(`Location: ${componentDir}`));
  } catch (error) {
    console.error(
      chalk.bgRed.bold(" ERROR "),
      chalk.red("Failed to create component:"),
      error
    );
    process.exit(1);
  }
};

const componentName = process.env.NAME;
const noCss = process.argv.includes("--no-css");
const astro = process.argv.includes("--astro");

createComponent({
  astro,
  name: componentName || "",
  noCss,
});
