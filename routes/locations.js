import { Router } from "express";
import { getLocationsPage, getLocationData } from "../controllers/locationsController.js";

const router = Router();

router.get("/", getLocationsPage);
router.get("/data", getLocationData);

export default router;
