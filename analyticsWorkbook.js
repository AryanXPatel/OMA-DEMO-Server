const RAW_RANGES = {
  orders: "New_Order_Table!A1:AI",
  customers: "Customer_Master!A1:N",
  products: "Product_Master!A1:L",
  ledger: "Customer_Ledger_2!A1:S",
};

const OUTPUT_SHEETS = {
  orderHeader: "Order_Header_Fact",
  customerSnapshot: "Customer_Account_Snapshot",
  analyticsDaily: "Analytics_KPI_Daily",
  arOpenItems: "AR_Open_Items_Fact",
  attentionQueue: "Attention_Queue_Snapshot",
};

const ORDER_HEADER_FIELDS = [
  "order_id",
  "customer_name",
  "customer_code",
  "customer_contact",
  "user",
  "source",
  "created_at",
  "dispatch_at",
  "status",
  "item_count",
  "quantity_total",
  "total_amount",
  "approved_items",
  "dispatched_items",
  "cycle_hours",
  "age_hours",
  "product_groups",
  "products",
  "latest_manager_comment",
  "latest_dispatch_comment",
];

const CUSTOMER_SNAPSHOT_FIELDS = [
  "customer_code",
  "customer_name",
  "customer_contact",
  "customer_group",
  "total_exposure",
  "current_exposure",
  "thirty_day_exposure",
  "sixty_day_exposure",
  "ninety_day_exposure",
  "high_risk_exposure",
  "collected_value",
  "invoiced_value",
  "collection_rate",
  "average_age_days",
  "last_updated_at",
];

const ANALYTICS_DAILY_FIELDS = [
  "as_of_date",
  "order_count",
  "total_value",
  "open_value",
  "dispatched_value",
  "dispatched_orders",
  "pending_approvals",
  "pending_approval_value",
  "pending_dispatches",
  "pending_dispatch_value",
  "rejected_orders",
  "rejected_value",
  "active_customers",
  "active_reps",
  "average_order_value",
  "dispatch_rate",
  "throughput_rate",
  "avg_dispatch_hours",
  "average_open_age_hours",
  "aged_pending_approvals",
  "aged_dispatch_queue",
  "high_value_threshold",
  "high_value_open_orders",
  "top_customer_share",
  "top_source_share",
  "total_exposure",
  "current_exposure",
  "thirty_exposure",
  "sixty_exposure",
  "ninety_exposure",
  "high_risk_exposure",
  "collected_value",
  "invoiced_value",
  "collection_rate",
  "average_age_days",
  "last_updated_at",
];

const AR_OPEN_FIELDS = [
  "txn_id",
  "customer_code",
  "voucher_number",
  "voucher_type",
  "invoice_date_iso",
  "due_date_iso",
  "open_amount",
  "age_days",
  "age_bucket",
  "sales_owner",
  "zone",
  "risk_tier",
];

const ATTENTION_QUEUE_FIELDS = [
  "snapshot_date",
  "queue_type",
  "entity_type",
  "entity_id",
  "customer_code",
  "severity",
  "reason_code",
  "headline",
  "amount",
  "age_hours",
  "owner",
];

const SEVERITY_RANK = {
  danger: 4,
  critical: 3,
  warning: 3,
  high: 2,
  success: 1,
  info: 1,
  medium: 1,
  low: 0,
};

function rowsToObjects(values) {
  if (!Array.isArray(values) || values.length < 2) {
    return [];
  }

  const [headers, ...rows] = values;
  return rows.map((row) =>
    headers.reduce((record, key, index) => {
      record[String(key || "").trim()] = row[index] || "";
      return record;
    }, {})
  );
}

function toNumber(value) {
  const parsed = Number.parseFloat(String(value || "0").replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseIndianDate(value) {
  if (!value) {
    return null;
  }

  const text = String(value).trim();
  const match = text.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?:\s*(AM|PM))?)?$/i
  );

  if (!match) {
    return null;
  }

  const [, day, month, year, hour = "0", minute = "0", meridiem = ""] = match;
  let hours = Number.parseInt(hour, 10);
  const minutes = Number.parseInt(minute, 10);
  const normalizedMeridiem = meridiem.toUpperCase();

  if (normalizedMeridiem === "PM" && hours < 12) {
    hours += 12;
  }
  if (normalizedMeridiem === "AM" && hours === 12) {
    hours = 0;
  }

  const parsed = new Date(
    Date.UTC(
      Number.parseInt(year, 10),
      Number.parseInt(month, 10) - 1,
      Number.parseInt(day, 10),
      hours,
      minutes
    )
  );

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseLedgerDate(value) {
  if (!value) {
    return null;
  }

  const text = String(value).trim();
  const match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) {
    return null;
  }

  const [, month, day, year] = match;
  const parsed = new Date(
    Date.UTC(
      Number.parseInt(year, 10),
      Number.parseInt(month, 10) - 1,
      Number.parseInt(day, 10)
    )
  );

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseIso(value) {
  if (!value) {
    return null;
  }

  const parsed = new Date(String(value).trim());
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toIsoTimestamp(value) {
  if (!value) {
    return "";
  }

  return value.toISOString().replace(/\.\d{3}Z$/, ".000Z");
}

function parseActivityDate(value) {
  return (
    parseIso(value) ||
    parseIndianDate(value) ||
    parseLedgerDate(value) ||
    null
  );
}

function compactOrderId(orderId) {
  const match = String(orderId || "")
    .trim()
    .match(/^(20\d{2})(?:-20\d{2})?[_-](\d+)/);

  if (!match) {
    return String(orderId || "").trim();
  }

  return `${match[1].slice(-2)}-${match[2].slice(-4).padStart(4, "0")}`;
}

function normalizeSourceChannel(source) {
  const normalized = String(source || "").trim().toLowerCase();
  if (!normalized) return "Direct";
  if (normalized.includes("whatsapp")) return "WhatsApp";
  if (normalized.includes("phone")) return "Phone";
  if (normalized.includes("sales")) return "Sales Team";
  return String(source || "").trim();
}

function uniqueJoin(values) {
  return Array.from(
    new Set(values.map((value) => String(value || "").trim()).filter(Boolean))
  ).join(" | ");
}

function ageBucket(days) {
  if (days <= 30) return "current";
  if (days <= 60) return "31-60";
  if (days <= 90) return "61-90";
  return "90+";
}

function toSheetValues(fields, rows) {
  return [
    fields,
    ...rows.map((row) => fields.map((field) => row[field] ?? "")),
  ];
}

function buildCustomerMaps(customerValues) {
  const customerRows = rowsToObjects(customerValues);
  const byCode = new Map();
  const byName = new Map();

  customerRows.forEach((row) => {
    const code = row["Customer CODE"] || "";
    const name = row["Customer NAME"] || "";
    if (code) byCode.set(code, row);
    if (name) byName.set(name, row);
  });

  return { byCode, byName };
}

function buildProductMaps(productValues) {
  const productRows = rowsToObjects(productValues);
  const byCode = new Map();
  const byName = new Map();

  productRows.forEach((row) => {
    const code = row["Product CODE"] || "";
    const name = row["Product NAME"] || "";
    if (code) byCode.set(code, row);
    if (name) byName.set(name, row);
  });

  return { byCode, byName };
}

function buildNormalizedOrders(orderValues, customerMaps, productMaps) {
  return rowsToObjects(orderValues)
    .map((row, index) => {
      const customer =
        customerMaps.byCode.get(row.customer_code_snapshot || "") ||
        customerMaps.byName.get(row["CUSTOMER NAME"] || "");
      const product =
        productMaps.byCode.get(row.product_code_snapshot || "") ||
        productMaps.byName.get(row["PRODUCT NAME"] || "");
      const approvalStatus =
        row.approval_status_norm ||
        (String(row["APPROVED BY MANAGER: Y/N/R"] || "")
          .trim()
          .toUpperCase() === "Y"
          ? "approved_waiting_dispatch"
          : String(row["APPROVED BY MANAGER: Y/N/R"] || "")
              .trim()
              .toUpperCase() === "N"
          ? "rejected"
          : "pending_approval");
      const dispatchStatus =
        row.dispatch_status_norm ||
        (String(row["ORDER DISPATCHED: Y/N"] || "")
          .trim()
          .toUpperCase() === "Y"
          ? "dispatched"
          : approvalStatus === "approved_waiting_dispatch"
          ? "pending_dispatch"
          : "not_ready");

      return {
        orderId: row["ORDER ID"] || "",
        customerName: row["CUSTOMER NAME"] || "Unknown customer",
        customerCode:
          row.customer_code_snapshot || customer?.["Customer CODE"] || "",
        customerContact: customer?.Contact || "",
        user: row.USER || "Unassigned",
        source:
          row.source_channel_norm || normalizeSourceChannel(row.SOURCE || ""),
        createdAt:
          parseIso(row.order_created_at_iso) ||
          parseIndianDate(row["SYS-TIME"]) ||
          parseIndianDate(row["ORDER-TIME"]),
        dispatchAt:
          parseIso(row.dispatch_at_iso) ||
          parseIndianDate(row["DISPATCH TIME"]),
        productName: row["PRODUCT NAME"] || "Unknown product",
        productGroup:
          row.product_group_snapshot ||
          product?.["Product Group Name"] ||
          product?.product_group_norm ||
          "Ungrouped",
        quantity: toNumber(row.QUANTITY),
        amount: toNumber(row["ORDER AMOUNT"]),
        approvalStatus,
        dispatchStatus,
        managerComments: row["MANAGER COMMENTS"] || "",
        dispatchComments: row["DISPATCH COMMENTS"] || "",
        index,
      };
    })
    .filter((row) => row.orderId);
}

function groupedOrderStatus(lines) {
  if (lines.some((line) => line.approvalStatus === "rejected")) return "rejected";
  if (lines.every((line) => line.dispatchStatus === "dispatched")) return "dispatched";
  if (
    lines.every(
      (line) =>
        line.approvalStatus === "approved_waiting_dispatch" ||
        line.dispatchStatus === "dispatched"
    )
  ) {
    return "approved";
  }
  return "pending";
}

function buildOrderHeaderFactRows(normalizedOrders, snapshotMoment) {
  const groups = new Map();
  normalizedOrders.forEach((row) => {
    groups.set(row.orderId, [...(groups.get(row.orderId) || []), row]);
  });

  return Array.from(groups.entries())
    .map(([orderId, rows]) => {
      const first = rows[0];
      const createdAt =
        rows.map((row) => row.createdAt).filter(Boolean).sort((a, b) => a - b)[0] ||
        null;
      const dispatchCandidates = rows
        .map((row) => row.dispatchAt)
        .filter(Boolean)
        .sort((a, b) => a - b);
      const dispatchAt = dispatchCandidates.length
        ? dispatchCandidates[dispatchCandidates.length - 1]
        : null;
      const status = groupedOrderStatus(rows);
      const totalAmount = rows.reduce((sum, row) => sum + row.amount, 0);
      const quantityTotal = rows.reduce((sum, row) => sum + row.quantity, 0);
      const approvedItems = rows.filter(
        (row) =>
          row.approvalStatus === "approved_waiting_dispatch" ||
          row.dispatchStatus === "dispatched"
      ).length;
      const dispatchedItems = rows.filter(
        (row) => row.dispatchStatus === "dispatched"
      ).length;
      const cycleHours =
        createdAt && dispatchAt
          ? Number(((dispatchAt - createdAt) / 36e5).toFixed(2))
          : "";
      const ageHours =
        createdAt && !dispatchAt
          ? Number(((snapshotMoment - createdAt) / 36e5).toFixed(2))
          : "";

      return {
        order_id: orderId,
        customer_name: first.customerName,
        customer_code: first.customerCode,
        customer_contact: first.customerContact,
        user: first.user,
        source: first.source,
        created_at: toIsoTimestamp(createdAt),
        dispatch_at: toIsoTimestamp(dispatchAt),
        status,
        item_count: rows.length,
        quantity_total: Number(quantityTotal.toFixed(2)),
        total_amount: Number(totalAmount.toFixed(2)),
        approved_items: approvedItems,
        dispatched_items: dispatchedItems,
        cycle_hours: cycleHours,
        age_hours: ageHours,
        product_groups: uniqueJoin(rows.map((row) => row.productGroup)),
        products: uniqueJoin(rows.map((row) => row.productName)),
        latest_manager_comment:
          rows.find((row) => row.managerComments)?.managerComments || "",
        latest_dispatch_comment:
          rows.find((row) => row.dispatchComments)?.dispatchComments || "",
      };
    })
    .sort((left, right) =>
      String(right.created_at || "").localeCompare(String(left.created_at || ""))
    );
}

function buildLedgerRecords(ledgerValues) {
  return rowsToObjects(ledgerValues).map((row, index) => {
    const txnDate = parseIso(row.txn_date_iso) || parseLedgerDate(row.DATE);
    const dueDate =
      parseIso(row.due_date_iso) ||
      (txnDate ? new Date(txnDate.getTime() + 30 * 86400000) : null);

    return {
      ...row,
      txnId: row.txn_id || row.LINK || `TXN-${String(index + 1).padStart(5, "0")}`,
      txnDate,
      dueDate,
      dc: String(row.DC || "").trim().toUpperCase(),
      amount: toNumber(row.AMT),
      openAmount:
        row.open_amount !== undefined && row.open_amount !== ""
          ? Math.abs(toNumber(row.open_amount))
          : String(row.DC || "").trim().toUpperCase() === "D"
          ? Math.abs(toNumber(row.AMT))
          : 0,
      signedAmount:
        row.signed_amount !== undefined && row.signed_amount !== ""
          ? toNumber(row.signed_amount)
          : toNumber(row["Amount (+-)"]),
      customerCode: row["CUSTOMER CODE"] || "",
      customerName: row["CUSTOMER NAME"] || "Unknown customer",
      customerGroup: row["CUSTOMER GROUP"] || "",
      voucherType: row.voucher_type_norm || row.VTYPE || "",
      voucherNumber: row.LINK || "",
    };
  });
}

function buildCustomerAccountSnapshotRows(ledgerRecords, customerMaps, snapshotIso, snapshotMoment) {
  const groups = new Map();
  ledgerRecords.forEach((row) => {
    const key = row.customerCode || row.customerName;
    groups.set(key, [...(groups.get(key) || []), row]);
  });

  return Array.from(groups.entries())
    .map(([key, rows]) => {
      const customer =
        customerMaps.byCode.get(key) || customerMaps.byName.get(rows[0].customerName);
      let current = 0;
      let thirty = 0;
      let sixty = 0;
      let ninety = 0;
      let collected = 0;
      let invoiced = 0;
      let weightedAge = 0;

      rows.forEach((row) => {
        if (row.dc === "C") {
          collected += Math.abs(row.signedAmount || row.amount);
          return;
        }
        if (row.dc !== "D") {
          return;
        }

        const amount = Math.abs(row.amount);
        invoiced += amount;
        if (row.txnDate) {
          const age = Math.max(
            0,
            Math.round((snapshotMoment - row.txnDate) / 86400000)
          );
          weightedAge += age * amount;
          if (age <= 30) current += amount;
          else if (age <= 60) thirty += amount;
          else if (age <= 90) sixty += amount;
          else ninety += amount;
        }
      });

      const totalExposure = current + thirty + sixty + ninety;

      return {
        customer_code: rows[0].customerCode || "",
        customer_name: rows[0].customerName,
        customer_contact: customer?.Contact || "",
        customer_group: rows[0].customerGroup,
        total_exposure: Number(totalExposure.toFixed(2)),
        current_exposure: Number(current.toFixed(2)),
        thirty_day_exposure: Number(thirty.toFixed(2)),
        sixty_day_exposure: Number(sixty.toFixed(2)),
        ninety_day_exposure: Number(ninety.toFixed(2)),
        high_risk_exposure: Number((sixty + ninety).toFixed(2)),
        collected_value: Number(collected.toFixed(2)),
        invoiced_value: Number(invoiced.toFixed(2)),
        collection_rate:
          invoiced > 0 ? Number(((collected / invoiced) * 100).toFixed(2)) : 0,
        average_age_days:
          totalExposure > 0 ? Number((weightedAge / totalExposure).toFixed(2)) : 0,
        last_updated_at: snapshotIso,
      };
    })
    .sort((left, right) => right.total_exposure - left.total_exposure);
}

function buildAnalyticsKpiDailyRows(orderHeaderRows, customerSnapshotRows, snapshotDate, snapshotIso) {
  const totalValue = orderHeaderRows.reduce(
    (sum, row) => sum + toNumber(row.total_amount),
    0
  );
  const openOrders = orderHeaderRows.filter((row) => row.status !== "dispatched");
  const dispatchedOrders = orderHeaderRows.filter((row) => row.status === "dispatched");
  const pendingOrders = orderHeaderRows.filter((row) => row.status === "pending");
  const approvedOrders = orderHeaderRows.filter((row) => row.status === "approved");
  const rejectedOrders = orderHeaderRows.filter((row) => row.status === "rejected");
  const activeCustomers = new Set(
    orderHeaderRows
      .map((row) => row.customer_code || row.customer_name)
      .filter(Boolean)
  ).size;
  const activeReps = new Set(orderHeaderRows.map((row) => row.user).filter(Boolean)).size;
  const cycleValues = dispatchedOrders
    .map((row) => Number(row.cycle_hours))
    .filter(Number.isFinite);
  const ageValues = openOrders
    .map((row) => Number(row.age_hours))
    .filter(Number.isFinite);

  const byCustomer = new Map();
  const bySource = new Map();
  orderHeaderRows.forEach((row) => {
    const customerKey = row.customer_code || row.customer_name;
    byCustomer.set(customerKey, (byCustomer.get(customerKey) || 0) + toNumber(row.total_amount));
    bySource.set(row.source, (bySource.get(row.source) || 0) + toNumber(row.total_amount));
  });

  const topCustomerValue = Math.max(0, ...Array.from(byCustomer.values()));
  const topSourceValue = Math.max(0, ...Array.from(bySource.values()));

  const totalExposure = customerSnapshotRows.reduce(
    (sum, row) => sum + toNumber(row.total_exposure),
    0
  );
  const currentExposure = customerSnapshotRows.reduce(
    (sum, row) => sum + toNumber(row.current_exposure),
    0
  );
  const thirtyExposure = customerSnapshotRows.reduce(
    (sum, row) => sum + toNumber(row.thirty_day_exposure),
    0
  );
  const sixtyExposure = customerSnapshotRows.reduce(
    (sum, row) => sum + toNumber(row.sixty_day_exposure),
    0
  );
  const ninetyExposure = customerSnapshotRows.reduce(
    (sum, row) => sum + toNumber(row.ninety_day_exposure),
    0
  );
  const highRiskExposure = customerSnapshotRows.reduce(
    (sum, row) => sum + toNumber(row.high_risk_exposure),
    0
  );
  const collectedValue = customerSnapshotRows.reduce(
    (sum, row) => sum + toNumber(row.collected_value),
    0
  );
  const invoicedValue = customerSnapshotRows.reduce(
    (sum, row) => sum + toNumber(row.invoiced_value),
    0
  );
  const averageAgeDays = customerSnapshotRows.length
    ? customerSnapshotRows.reduce(
        (sum, row) => sum + toNumber(row.average_age_days),
        0
      ) / customerSnapshotRows.length
    : 0;

  return [
    {
      as_of_date: snapshotDate,
      order_count: orderHeaderRows.length,
      total_value: Number(totalValue.toFixed(2)),
      open_value: Number(
        openOrders
          .reduce((sum, row) => sum + toNumber(row.total_amount), 0)
          .toFixed(2)
      ),
      dispatched_value: Number(
        dispatchedOrders
          .reduce((sum, row) => sum + toNumber(row.total_amount), 0)
          .toFixed(2)
      ),
      dispatched_orders: dispatchedOrders.length,
      pending_approvals: pendingOrders.length,
      pending_approval_value: Number(
        pendingOrders
          .reduce((sum, row) => sum + toNumber(row.total_amount), 0)
          .toFixed(2)
      ),
      pending_dispatches: approvedOrders.length,
      pending_dispatch_value: Number(
        approvedOrders
          .reduce((sum, row) => sum + toNumber(row.total_amount), 0)
          .toFixed(2)
      ),
      rejected_orders: rejectedOrders.length,
      rejected_value: Number(
        rejectedOrders
          .reduce((sum, row) => sum + toNumber(row.total_amount), 0)
          .toFixed(2)
      ),
      active_customers: activeCustomers,
      active_reps: activeReps,
      average_order_value:
        orderHeaderRows.length > 0
          ? Number((totalValue / orderHeaderRows.length).toFixed(2))
          : 0,
      dispatch_rate:
        orderHeaderRows.length > 0
          ? Number(((dispatchedOrders.length / orderHeaderRows.length) * 100).toFixed(2))
          : 0,
      throughput_rate:
        orderHeaderRows.length > 0
          ? Number(
              (((approvedOrders.length + dispatchedOrders.length) / orderHeaderRows.length) * 100).toFixed(2)
            )
          : 0,
      avg_dispatch_hours:
        cycleValues.length > 0
          ? Number((cycleValues.reduce((sum, value) => sum + value, 0) / cycleValues.length).toFixed(2))
          : "",
      average_open_age_hours:
        ageValues.length > 0
          ? Number((ageValues.reduce((sum, value) => sum + value, 0) / ageValues.length).toFixed(2))
          : "",
      aged_pending_approvals: pendingOrders.filter(
        (row) => row.age_hours !== "" && Number(row.age_hours) >= 24
      ).length,
      aged_dispatch_queue: approvedOrders.filter(
        (row) => row.age_hours !== "" && Number(row.age_hours) >= 24
      ).length,
      high_value_threshold: 100000,
      high_value_open_orders: openOrders.filter(
        (row) => toNumber(row.total_amount) >= 100000
      ).length,
      top_customer_share:
        totalValue > 0 ? Number((topCustomerValue / totalValue).toFixed(4)) : 0,
      top_source_share:
        totalValue > 0 ? Number((topSourceValue / totalValue).toFixed(4)) : 0,
      total_exposure: Number(totalExposure.toFixed(2)),
      current_exposure: Number(currentExposure.toFixed(2)),
      thirty_exposure: Number(thirtyExposure.toFixed(2)),
      sixty_exposure: Number(sixtyExposure.toFixed(2)),
      ninety_exposure: Number(ninetyExposure.toFixed(2)),
      high_risk_exposure: Number(highRiskExposure.toFixed(2)),
      collected_value: Number(collectedValue.toFixed(2)),
      invoiced_value: Number(invoicedValue.toFixed(2)),
      collection_rate:
        invoicedValue > 0
          ? Number(((collectedValue / invoicedValue) * 100).toFixed(2))
          : 0,
      average_age_days: Number(averageAgeDays.toFixed(2)),
      last_updated_at: snapshotIso,
    },
  ];
}

function buildArOpenItemsRows(ledgerRecords, customerMaps, snapshotMoment) {
  return ledgerRecords
    .filter((row) => row.dc === "D")
    .map((row) => {
      const customer =
        customerMaps.byCode.get(row.customerCode) ||
        customerMaps.byName.get(row.customerName);
      const ageDays = row.txnDate
        ? Math.max(0, Math.round((snapshotMoment - row.txnDate) / 86400000))
        : 0;
      const dueDate =
        row.dueDate ||
        (row.txnDate ? new Date(row.txnDate.getTime() + 30 * 86400000) : null);

      return {
        txn_id: row.txnId,
        customer_code: row.customerCode,
        voucher_number: row.voucherNumber,
        voucher_type: row.voucherType,
        invoice_date_iso: toIsoTimestamp(row.txnDate),
        due_date_iso: toIsoTimestamp(dueDate),
        open_amount: Number(Math.abs(row.openAmount || row.amount).toFixed(2)),
        age_days: ageDays,
        age_bucket: ageBucket(ageDays),
        sales_owner: customer?.sales_owner || "",
        zone: customer?.zone || "",
        risk_tier: customer?.risk_tier || "",
      };
    });
}

function buildAttentionQueueRows(orderHeaderRows, arOpenItemsRows, snapshotDate) {
  const orderRows = orderHeaderRows
    .filter((row) => ["pending", "approved", "rejected"].includes(row.status))
    .map((row) => ({
      snapshot_date: snapshotDate,
      queue_type: "orders",
      entity_type: "order",
      entity_id: row.order_id,
      customer_code: row.customer_code,
      severity:
        row.status === "rejected"
          ? "critical"
          : row.status === "pending" && row.age_hours !== "" && Number(row.age_hours) >= 24
          ? "high"
          : "medium",
      reason_code:
        row.status === "rejected"
          ? "rejected_order"
          : row.status === "approved"
          ? "ready_for_dispatch"
          : "pending_approval",
      headline: `${row.customer_name} order requires attention`,
      amount: Number(toNumber(row.total_amount).toFixed(2)),
      age_hours: row.age_hours,
      owner: row.user,
    }));

  const receivableRows = arOpenItemsRows
    .filter((row) => ["61-90", "90+"].includes(row.age_bucket))
    .map((row) => ({
      snapshot_date: snapshotDate,
      queue_type: "collections",
      entity_type: "receivable",
      entity_id: row.txn_id,
      customer_code: row.customer_code,
      severity: row.age_bucket === "90+" ? "critical" : "high",
      reason_code: "aged_receivable",
      headline: `Receivable aging past ${row.age_bucket} days`,
      amount: row.open_amount,
      age_hours: row.age_days * 24,
      owner: row.sales_owner,
    }));

  return [...orderRows, ...receivableRows];
}

function pushActivity(events, event) {
  if (!event || !event.entity_id || !event.occurred_at) {
    return;
  }

  const id = event.event_id || `${event.event_type}:${event.entity_id}:${event.occurred_at}`;
  events.set(id, {
    amount: "",
    actor_name: "",
    actor_role: "",
    customer_code: "",
    customer_name: "",
    display_id: compactOrderId(event.entity_id),
    entity_type: "order",
    message: "",
    severity: "info",
    source: "derived",
    ...event,
    event_id: id,
  });
}

function buildOrderActivityEvents(orderValues, customerMaps, productMaps) {
  const normalizedOrders = buildNormalizedOrders(orderValues, customerMaps, productMaps);
  const rawOrderRows = rowsToObjects(orderValues);
  const groups = new Map();

  normalizedOrders.forEach((row) => {
    groups.set(row.orderId, [...(groups.get(row.orderId) || []), row]);
  });

  const events = new Map();

  Array.from(groups.entries()).forEach(([orderId, rows]) => {
    const first = rows[0];
    const rawRows = rawOrderRows.filter(
      (row) => String(row["ORDER ID"] || "").trim() === orderId
    );
    const createdAt =
      rows.map((row) => row.createdAt).filter(Boolean).sort((a, b) => a - b)[0] ||
      null;
    const approvalAt =
      rawRows
        .map((row) => parseActivityDate(row.approval_at_iso || row.last_status_at_iso))
        .filter(Boolean)
        .sort((a, b) => b - a)[0] || null;
    const dispatchAt =
      rows.map((row) => row.dispatchAt).filter(Boolean).sort((a, b) => b - a)[0] ||
      null;
    const invoiceAt =
      rawRows
        .map((row) => parseActivityDate(row.invoice_date_iso))
        .filter(Boolean)
        .sort((a, b) => b - a)[0] || null;
    const cancelledAt =
      rawRows
        .map((row) => parseActivityDate(row.cancelled_at_iso))
        .filter(Boolean)
        .sort((a, b) => b - a)[0] || null;
    const status = groupedOrderStatus(rows);
    const totalAmount = rows.reduce((sum, row) => sum + row.amount, 0);
    const itemLabel = `${rows.length} ${rows.length === 1 ? "item" : "items"}`;

    pushActivity(events, {
      event_type: "order.created",
      entity_id: orderId,
      customer_code: first.customerCode,
      customer_name: first.customerName,
      actor_name: first.user,
      actor_role: "User",
      occurred_at: toIsoTimestamp(createdAt),
      title: "Order created",
      message: `${compactOrderId(orderId)} for ${first.customerName} (${itemLabel})`,
      amount: Number(totalAmount.toFixed(2)),
      severity: "info",
      source: "New_Order_Table",
    });

    if (status === "rejected") {
      pushActivity(events, {
        event_type: "approval.rejected",
        entity_id: orderId,
        customer_code: first.customerCode,
        customer_name: first.customerName,
        actor_name: first.user,
        actor_role: "Manager",
        occurred_at: toIsoTimestamp(approvalAt || createdAt),
        title: "Order blocked",
        message: `${first.customerName} requires manager follow-up`,
        amount: Number(totalAmount.toFixed(2)),
        severity: "danger",
        source: "New_Order_Table",
      });
    } else if (status === "approved" || status === "dispatched") {
      pushActivity(events, {
        event_type: "approval.approved",
        entity_id: orderId,
        customer_code: first.customerCode,
        customer_name: first.customerName,
        actor_name: first.user,
        actor_role: "Manager",
        occurred_at: toIsoTimestamp(approvalAt || dispatchAt || createdAt),
        title: "Order approved",
        message: `${first.customerName} is ready for dispatch`,
        amount: Number(totalAmount.toFixed(2)),
        severity: "success",
        source: "New_Order_Table",
      });
    }

    if (status === "dispatched" && dispatchAt) {
      pushActivity(events, {
        event_type: "dispatch.completed",
        entity_id: orderId,
        customer_code: first.customerCode,
        customer_name: first.customerName,
        actor_name: first.user,
        actor_role: "User",
        occurred_at: toIsoTimestamp(dispatchAt),
        title: "Order dispatched",
        message: `${first.customerName} moved to fulfillment`,
        amount: Number(totalAmount.toFixed(2)),
        severity: "success",
        source: "New_Order_Table",
      });
    }

    if (invoiceAt) {
      pushActivity(events, {
        event_type: "invoice.issued",
        entity_id: orderId,
        customer_code: first.customerCode,
        customer_name: first.customerName,
        actor_name: first.user,
        actor_role: "System",
        occurred_at: toIsoTimestamp(invoiceAt),
        title: "Invoice posted",
        message: `${first.customerName} invoice is linked to ${compactOrderId(orderId)}`,
        amount: Number(totalAmount.toFixed(2)),
        severity: "info",
        source: "New_Order_Table",
      });
    }

    if (cancelledAt) {
      pushActivity(events, {
        event_type: "order.cancelled",
        entity_id: orderId,
        customer_code: first.customerCode,
        customer_name: first.customerName,
        actor_name: first.user,
        actor_role: "Manager",
        occurred_at: toIsoTimestamp(cancelledAt),
        title: "Order cancelled",
        message: `${first.customerName} order was cancelled`,
        amount: Number(totalAmount.toFixed(2)),
        severity: "danger",
        source: "New_Order_Table",
      });
    }
  });

  return Array.from(events.values());
}

function buildLedgerActivityEvents(ledgerValues) {
  return buildLedgerRecords(ledgerValues)
    .filter((row) => row.txnDate)
    .map((row) => {
      const isCredit = row.dc === "C";
      const amount = Math.abs(row.signedAmount || row.amount || row.openAmount || 0);
      return {
        event_id: `ledger.${isCredit ? "payment_received" : "invoice_posted"}:${row.txnId}:${toIsoTimestamp(row.txnDate)}`,
        event_type: isCredit ? "ledger.payment_received" : "ledger.invoice_posted",
        entity_type: "ledger_txn",
        entity_id: row.txnId,
        display_id: row.txnId,
        customer_code: row.customerCode,
        customer_name: row.customerName,
        actor_name: row.collector_owner || "",
        actor_role: row.collector_owner ? "Collector" : "System",
        occurred_at: toIsoTimestamp(row.txnDate),
        title: isCredit ? "Payment received" : "Invoice posted",
        message: `${row.customerName} ${isCredit ? "payment" : "invoice"} recorded`,
        amount: Number(amount.toFixed(2)),
        severity: isCredit ? "success" : "info",
        source: "Customer_Ledger_2",
      };
    });
}

function buildQueueActivityEvents(attentionValues, customerMaps) {
  return rowsToObjects(attentionValues)
    .map((row) => {
      const occurredAt = parseActivityDate(row.snapshot_date);
      const customer = customerMaps.byCode.get(row.customer_code || "");
      const entityId = row.entity_id || row.customer_code || row.headline;

      return {
        event_id: `queue.${row.reason_code || "attention"}:${entityId}:${toIsoTimestamp(occurredAt)}`,
        event_type: "queue.attention",
        entity_type: row.entity_type || "queue_item",
        entity_id: entityId,
        display_id: compactOrderId(entityId),
        customer_code: row.customer_code || "",
        customer_name: customer?.["Customer NAME"] || row.customer_code || "",
        actor_name: row.owner || "",
        actor_role: row.owner ? "Owner" : "System",
        occurred_at: toIsoTimestamp(occurredAt),
        title: row.headline || "Attention needed",
        message: row.reason_code || "Current queue item needs review",
        amount: row.amount === "" ? "" : toNumber(row.amount),
        severity:
          row.severity === "critical"
            ? "danger"
            : row.severity === "high"
            ? "warning"
            : "info",
        source: "Attention_Queue_Snapshot",
      };
    })
    .filter((event) => event.entity_id && event.occurred_at);
}

function sortActivityEvents(events) {
  return events.sort((left, right) => {
    const dateDiff =
      new Date(right.occurred_at).getTime() - new Date(left.occurred_at).getTime();
    if (dateDiff !== 0) {
      return dateDiff;
    }
    return (
      (SEVERITY_RANK[right.severity] || 0) -
      (SEVERITY_RANK[left.severity] || 0)
    );
  });
}

function buildRecentActivityFeed({
  orderValues,
  customerValues,
  productValues,
  ledgerValues,
  attentionValues = [],
  limit = 10,
}) {
  const customerMaps = buildCustomerMaps(customerValues);
  const productMaps = buildProductMaps(productValues);
  const historicalEvents = new Map();
  const queueEvents = new Map();
  const clampedLimit = Math.max(1, Math.min(Number(limit) || 10, 25));

  [
    ...buildOrderActivityEvents(orderValues, customerMaps, productMaps),
    ...buildLedgerActivityEvents(ledgerValues),
  ].forEach((event) => pushActivity(historicalEvents, event));

  buildQueueActivityEvents(attentionValues, customerMaps).forEach((event) =>
    pushActivity(queueEvents, event)
  );

  const sortedHistorical = sortActivityEvents(Array.from(historicalEvents.values()));
  const sortedQueue = sortActivityEvents(Array.from(queueEvents.values()));
  const queueFillCount = Math.max(
    0,
    Math.min(2, clampedLimit - sortedHistorical.length)
  );

  return [...sortedHistorical, ...sortedQueue.slice(0, queueFillCount)].slice(
    0,
    clampedLimit
  );
}

function buildAnalyticsWorkbook({
  orderValues,
  customerValues,
  productValues,
  ledgerValues,
  snapshotMoment = new Date(),
}) {
  const customerMaps = buildCustomerMaps(customerValues);
  const productMaps = buildProductMaps(productValues);
  const normalizedOrders = buildNormalizedOrders(
    orderValues,
    customerMaps,
    productMaps
  );
  const orderHeaderRows = buildOrderHeaderFactRows(
    normalizedOrders,
    snapshotMoment
  );
  const ledgerRecords = buildLedgerRecords(ledgerValues);
  const snapshotIso = toIsoTimestamp(snapshotMoment);
  const snapshotDate = snapshotIso.slice(0, 10);
  const customerSnapshotRows = buildCustomerAccountSnapshotRows(
    ledgerRecords,
    customerMaps,
    snapshotIso,
    snapshotMoment
  );
  const analyticsDailyRows = buildAnalyticsKpiDailyRows(
    orderHeaderRows,
    customerSnapshotRows,
    snapshotDate,
    snapshotIso
  );
  const arOpenItemRows = buildArOpenItemsRows(
    ledgerRecords,
    customerMaps,
    snapshotMoment
  );
  const attentionQueueRows = buildAttentionQueueRows(
    orderHeaderRows,
    arOpenItemRows,
    snapshotDate
  );

  return {
    [OUTPUT_SHEETS.orderHeader]: toSheetValues(ORDER_HEADER_FIELDS, orderHeaderRows),
    [OUTPUT_SHEETS.customerSnapshot]: toSheetValues(
      CUSTOMER_SNAPSHOT_FIELDS,
      customerSnapshotRows
    ),
    [OUTPUT_SHEETS.analyticsDaily]: toSheetValues(
      ANALYTICS_DAILY_FIELDS,
      analyticsDailyRows
    ),
    [OUTPUT_SHEETS.arOpenItems]: toSheetValues(AR_OPEN_FIELDS, arOpenItemRows),
    [OUTPUT_SHEETS.attentionQueue]: toSheetValues(
      ATTENTION_QUEUE_FIELDS,
      attentionQueueRows
    ),
  };
}

module.exports = {
  RAW_RANGES,
  OUTPUT_SHEETS,
  buildAnalyticsWorkbook,
  buildRecentActivityFeed,
};
