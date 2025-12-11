const crypto = require('crypto');

const BASE_URL = 'http://localhost:8000/api';
let TOKEN = '';
let USER_ID = '';

async function req(method, endpoint, body = null, token = null) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const opts = {
        method,
        headers,
    };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(`${BASE_URL}${endpoint}`, opts);
    const data = await res.json();
    return { status: res.status, data };
}

async function run() {
    console.log('--- STARTING VERIFICATION ---');

    // 1. Register / Login
    const phone = '0599999999'; // Test phone
    console.log(`1. Requesting OTP for ${phone}...`);
    const r1 = await req('POST', '/auth/request-otp', { phone });
    if (!r1.data.success) throw new Error('Failed to request OTP');

    const code = r1.data.debugCode;
    console.log(`   OTP Sent. Debug Code: ${code}`);

    console.log('2. Verifying OTP...');
    const r2 = await req('POST', '/auth/verify-otp', { phone, code });

    if (r2.data.status === 'new') {
        console.log('   User is new. Completing profile...');
        const r3 = await req('POST', '/auth/complete-profile', {
            phone,
            full_name: 'Test Verify User',
            account_type: 'individual',
            sector: 'cars',
            city: 'Riyadh',
            email: `test${crypto.randomBytes(4).toString('hex')}@example.com`
        });
        if (!r3.data.success) throw new Error(`Failed complete profile: ${r3.data.message}`);
        TOKEN = r3.data.token;
        USER_ID = r3.data.user.id;
    } else {
        console.log('   User exists. Logged in.');
        console.log('DEBUG RES:', JSON.stringify(r2.data, null, 2));
        TOKEN = r2.data.token;
        if (!r2.data.user) throw new Error('User object missing in login response');
        USER_ID = r2.data.user.id;
    }
    console.log(`   Logged in as User ID: ${USER_ID}`);

    // 3. Create Listing -> Check 'first_listing'
    console.log('3. Creating Listing...');
    const r4 = await req('POST', '/listings', {
        type: 'car',
        title: 'Test Car ' + Date.now(),
        price: 50000,
        currency: 'SAR',
        city: 'Riyadh',
        category: 'sedan',
        status: 'sale',
        is_published: true
    }, TOKEN);

    if (!r4.data.success) throw new Error(`Failed to create listing: ${r4.data.message}`);

    console.log('   Listing created. Checking onboarding status...');
    const r5 = await req('GET', '/onboarding', null, TOKEN);
    const stepFirstListing = r5.data.steps.find(s => s.step_key === 'first_listing');

    if (stepFirstListing.status === 'done') {
        console.log('   [PASS] first_listing is DONE');
    } else {
        console.error('   [FAIL] first_listing status:', stepFirstListing.status);
        process.exit(1);
    }

    // 4. Subscribe Package -> Check 'plan'
    console.log('4. Subscribing to Package...');
    const r6 = await req('POST', '/packages/subscribe', { packageId: 'starter' }, TOKEN);
    if (!r6.data.success) throw new Error(`Failed subscribe: ${r6.data.message}`);

    const r7 = await req('GET', '/onboarding', null, TOKEN);
    const stepPlan = r7.data.steps.find(s => s.step_key === 'plan');

    if (stepPlan.status === 'done') {
        console.log('   [PASS] plan is DONE');
    } else {
        console.error('   [FAIL] plan status:', stepPlan.status);
        process.exit(1);
    }

    // 5. Setup Site -> Publish -> Check 'publish_site'
    console.log('5. Publishing Site...');
    // Note: We need a unique slug
    const slug = 'testsite' + crypto.randomBytes(4).toString('hex');
    const r8 = await req('POST', '/site', {
        sector: 'cars',
        slug,
        name: 'My Test Site',
        template_key: 'carClassic',
        is_published: true
    }, TOKEN);

    if (!r8.data.success) throw new Error(`Failed to publish site: ${r8.data.message}`);

    const r9 = await req('GET', '/onboarding', null, TOKEN);
    const stepPublish = r9.data.steps.find(s => s.step_key === 'publish_site');
    const stepSetup = r9.data.steps.find(s => s.step_key === 'site_setup'); // Should also be done

    if (stepPublish.status === 'done' && stepSetup.status === 'done') {
        console.log('   [PASS] site_setup and publish_site are DONE');
    } else {
        if (stepSetup.status !== 'done') console.error('   [FAIL] site_setup status:', stepSetup.status);
        if (stepPublish.status !== 'done') console.error('   [FAIL] publish_site status:', stepPublish.status);
        process.exit(1);
    }

    console.log('--- ALL VERIFICATIONS PASSED ---');
}

run().catch(err => {
    console.error('ERROR:', err);
    process.exit(1);
});
