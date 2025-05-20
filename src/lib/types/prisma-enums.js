"use strict";
// Vrednosti ovih enuma MORAJU tačno odgovarati prisma/schema.prisma
Object.defineProperty(exports, "__esModule", { value: true });
exports.SenderType = exports.AppointmentStatus = exports.VendorStatus = exports.UserRole = void 0;
var UserRole;
(function (UserRole) {
    UserRole["USER"] = "USER";
    UserRole["VENDOR_OWNER"] = "VENDOR_OWNER";
    UserRole["WORKER"] = "WORKER";
    UserRole["SUPER_ADMIN"] = "SUPER_ADMIN";
})(UserRole || (exports.UserRole = UserRole = {}));
var VendorStatus;
(function (VendorStatus) {
    VendorStatus["PENDING_APPROVAL"] = "PENDING_APPROVAL";
    VendorStatus["ACTIVE"] = "ACTIVE";
    VendorStatus["SUSPENDED"] = "SUSPENDED";
    VendorStatus["REJECTED"] = "REJECTED";
})(VendorStatus || (exports.VendorStatus = VendorStatus = {}));
var AppointmentStatus;
(function (AppointmentStatus) {
    AppointmentStatus["PENDING"] = "PENDING";
    AppointmentStatus["CONFIRMED"] = "CONFIRMED";
    AppointmentStatus["CANCELLED_BY_USER"] = "CANCELLED_BY_USER";
    AppointmentStatus["CANCELLED_BY_VENDOR"] = "CANCELLED_BY_VENDOR";
    AppointmentStatus["REJECTED"] = "REJECTED";
    AppointmentStatus["COMPLETED"] = "COMPLETED";
    AppointmentStatus["NO_SHOW"] = "NO_SHOW";
})(AppointmentStatus || (exports.AppointmentStatus = AppointmentStatus = {}));
var SenderType;
(function (SenderType) {
    SenderType["USER"] = "USER";
    SenderType["ADMIN"] = "ADMIN";
    SenderType["AI"] = "AI";
})(SenderType || (exports.SenderType = SenderType = {}));
//# sourceMappingURL=prisma-enums.js.map