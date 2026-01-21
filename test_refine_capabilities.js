import { Whisk } from "@rohitaryal/whisk-api";
import dotenv from "dotenv";

dotenv.config();

const whisk = new Whisk(process.env.COOKIE_WHISK);

async function inspect() {
    try {
        console.log("Creating project...");
        const project = await whisk.newProject("Inspection Project");

        console.log("Project methods:", Object.getOwnPropertyNames(Object.getPrototypeOf(project)));
        console.log("Whisk methods:", Object.getOwnPropertyNames(Object.getPrototypeOf(whisk)));

        console.log("Generating base image...");
        const media = await project.generateImage("A landscape of mountains");

        console.log("Media Object Keys:", Object.keys(media));
        console.log("Media Prototype Methods:", Object.getOwnPropertyNames(Object.getPrototypeOf(media)));

        // Check if there's an ID we can use
        console.log("Media ID:", media.id || media.mediaGenerationId);

        // Try to see if we can get media back from project
        // Note: This is speculative, looking for methods like getMedia, retrieve, etc.

    } catch (error) {
        console.error("Error:", error);
    }
}

inspect();
