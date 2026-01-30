import express from "express";
import { Openfort } from "@openfort/openfort-node";

const router = express.Router();

const openfort = new Openfort(process.env.OPENFORT_SECRET_KEY!);

router.post("/create-session", async (req, res) => {
    try {
        const session = await openfort.createEncryptionSession(
            process.env.OPENFORT_SHIELD_PUBLISHABLE_KEY!,
            process.env.OPENFORT_SHIELD_SECRET_KEY!,
            process.env.OPENFORT_SHIELD_ENCRYPTION_SHARE!
        );
        res.json(session);
    } catch (err: any) {
        console.error("create-session error", err);
        res.status(500).json({ error: "Failed to create encrypted session", details: err.message });
    }
});

export default router;
