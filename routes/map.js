import express from "express";
import { showMapPage, getLocations } from "../controllers/mapController.js";

const router = express.Router();

router.get("/", showMapPage);
router.get("/locations", getLocations);

export default router;
