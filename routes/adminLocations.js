import express from "express";
import {
  listLocations,
  showCreateForm,
  createLocation,
  showEditForm,
  updateLocation,
  deleteLocation,
  apiLocations,
  showTrashLocations,
  restoreLocation,
  hardDeleteLocation
} from "../controllers/adminLocationsController.js";

import { requireAuth, requireAdmin } from "../middleware/auth.js";


const router = express.Router();

router.get("/", requireAuth, requireAdmin, listLocations);


router.get("/create", requireAuth, requireAdmin, showCreateForm);
router.post("/create", requireAuth, requireAdmin, createLocation);

router.get("/edit/:id", requireAuth, requireAdmin, showEditForm);
router.post("/edit/:id", requireAuth, requireAdmin, updateLocation);

router.post("/delete/:id", requireAuth, requireAdmin, deleteLocation);

router.get("/api", requireAuth, requireAdmin, apiLocations);
// RECYCLE BIN – trang xem danh sách đã xóa
router.get("/trash", requireAuth, requireAdmin, showTrashLocations);

// RESTORE
router.post("/restore/:id", requireAuth, requireAdmin, restoreLocation);

// HARD DELETE
router.post("/hard-delete/:id", requireAuth, requireAdmin, hardDeleteLocation);


export default router;
