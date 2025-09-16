import {
  setWhatsappInvoiceStatus,
  setWhatsappPayrollStatus,
} from "./apiCloudnavis.js";

export const updateWhatsappStatuses = async (items = []) => {

  if (!Array.isArray(items)) {
    throw new TypeError("El parámetro debe ser un array");
  }

  const calls = items.map((item) => {
    const { messageType, source, response } = item || {};
    let status = "PENDIENTE";

    if (response === true) {
      status = "ENVIADO";
    } else if (response === false) {
      status = "ERROR";
    }

    if (messageType === "invoice") {
      return setWhatsappInvoiceStatus({ source, status });
    }

    if (messageType === "payRoll") {
      return setWhatsappPayrollStatus({ source, status });
    }

    return Promise.resolve(null);
  });

  return Promise.all(calls);
};
