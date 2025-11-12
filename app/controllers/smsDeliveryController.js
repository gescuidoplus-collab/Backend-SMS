import { MessageLog } from "../schemas/index.js";

export const getLogs = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    let [results, total] = await Promise.all([
      MessageLog.find(
        {},
        {
          _id: 1,
          sentAt: 1,
          reason: 1,
          status: 1,
          recipient: 1,
          source: 1,
          employe: 1,
          phoneNumber: 1,
          message: 1,
          phoneNumberTwo: 1,
          messageType: 1,
          fileUrl: 1,
        }
      )
        .skip(skip)
        .limit(limit),
      MessageLog.countDocuments(),
    ]);

    const responseData = {
      results,
      total,
      page,
      pages: Math.ceil(total / limit),
    };

    res.json(responseData);
  } catch (error) {
    console.error("Error en getLogs:", error);
    res.status(500).json({ error: error.message });
  }
};

export const getLogById = async (req, res) => {
  try {
    const log = await MessageLog.findById(req.params.id, {
      _id: 1,
      sentAt: 1,
      reason: 1,
      status: 1,
      recipient: 1,
      source: 1,
      employe: 1,
      phoneNumber: 1,
      phoneNumberTwo: 1,
      messageType: 1,
      fileUrl: 1,
    });
    if (!log) return res.status(404).json({ error: "Registro no encontrado" });
    const invoce = log.getDecryptedData ? log.getDecryptedData() : null;
    const payload = {
      log,
      invoce,
    };
    res.json(payload);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteLog = async (req, res) => {
  try {
    const deletedLog = await MessageLog.findByIdAndDelete(req.params.id);
    if (!deletedLog)
      return res.status(404).json({ error: "Registro no encontrado" });
    res.json({ message: "Registro eliminado correctamente" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
