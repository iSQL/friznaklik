"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    console.log('Starting Phase 0 data population for vendorIds...');
    // 1. Find the current admin user (adjust this logic as needed)
    const adminUser = await prisma.user.findFirst({
        where: { role: 'admin' }, // Or another unique identifier for your current admin
    });
    if (!adminUser) {
        console.error('Error: Could not find the admin user to assign as default vendor owner.');
        return;
    }
    console.log(`Found admin user: ${adminUser.email} (ID: ${adminUser.id})`);
    // 2. Create or find the default Vendor record
    let defaultVendor = await prisma.vendor.findUnique({
        where: { ownerId: adminUser.id },
    });
    if (defaultVendor) {
        console.log(`Default vendor for owner ${adminUser.email} already exists (ID: ${defaultVendor.id}).`);
    }
    else {
        defaultVendor = await prisma.vendor.create({
            data: {
                name: 'FrizNaKlik Original Salon',
                description: 'The original salon for FrizNaKlik.',
                ownerId: adminUser.id,
                address: 'Default Address',
                phoneNumber: '000-000-000',
                operatingHours: { /* ... your default hours ... */},
            },
        });
        console.log(`Created default vendor: ${defaultVendor.name} (ID: ${defaultVendor.id})`);
    }
    // 3. Update all existing Service records to link to the default Vendor
    const serviceUpdateResult = await prisma.service.updateMany({
        where: { vendorId: null }, // Update only those that are currently null
        data: { vendorId: defaultVendor.id },
    });
    console.log(`Updated ${serviceUpdateResult.count} services to link to default vendor.`);
    // 4. Update all existing Appointment records to link to the default Vendor
    const appointmentUpdateResult = await prisma.appointment.updateMany({
        where: { vendorId: null }, // Update only those that are currently null
        data: { vendorId: defaultVendor.id },
    });
    console.log(`Updated ${appointmentUpdateResult.count} appointments to link to default vendor.`);
    console.log('Phase 0 vendorId population completed successfully.');
}
main()
    .catch(async (e) => {
    console.error('Error during Phase 0 data population:', e);
    await prisma.$disconnect();
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=phase0-populate-vendorids.js.map