
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";

// Path to the recipes file in the project root
const RECIPES_FILE = path.resolve(process.cwd(), "recipes.json");

interface Recipe {
    id: string;
    title: string;
    ingredients: string[];
    instructions: string;
}

async function loadRecipes(): Promise<Recipe[]> {
    try {
        const data = await fs.readFile(RECIPES_FILE, "utf-8");
        return JSON.parse(data);
    } catch (error: any) {
        if (error.code === "ENOENT") {
            return [];
        }
        throw error;
    }
}

async function saveRecipes(recipes: Recipe[]) {
    await fs.writeFile(RECIPES_FILE, JSON.stringify(recipes, null, 2));
}

// Create server instance
const server = new McpServer({
    name: "recipe-saver",
    version: "1.0.0",
});

// Tool: Add a recipe
server.tool(
    "add_recipe",
    {
        title: z.string(),
        ingredients: z.array(z.string()),
        instructions: z.string(),
    },
    async ({ title, ingredients, instructions }) => {
        const recipes = await loadRecipes();
        const newRecipe: Recipe = {
            id: String(recipes.length + 1), // Simple ID generation
            title,
            ingredients,
            instructions,
        };
        recipes.push(newRecipe);
        await saveRecipes(recipes);
        return {
            content: [
                {
                    type: "text",
                    text: `Recipe '${title}' added with ID ${newRecipe.id}`,
                },
            ],
        };
    }
);

// Resource: List all recipes
server.resource(
    "recipe",
    "recipe://list",
    async (uri) => {
        const recipes = await loadRecipes();
        return {
            contents: [
                {
                    uri: uri.href,
                    text: JSON.stringify(recipes, null, 2),
                    mimeType: "application/json",
                },
            ],
        };
    }
);

// Resource: Get a specific recipe
server.resource(
    "recipe",
    "recipe://{id}",
    async (uri, { id }) => {
        const recipes = await loadRecipes();
        const recipe = recipes.find((r) => r.id === id);
        if (!recipe) {
            throw new Error(`Recipe not found: ${id}`);
        }
        return {
            contents: [
                {
                    uri: uri.href,
                    text: JSON.stringify(recipe, null, 2),
                    mimeType: "application/json",
                },
            ],
        };
    }
);

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Recipe Saver MCP Server running on stdio");
}

main().catch((error) => {
    console.error("Fatal error in main():", error);
    process.exit(1);
});
