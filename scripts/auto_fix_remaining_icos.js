const { execSync } = require('child_process');
require('dotenv').config({ path: '.env.local' });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Fetch all entities with NO_ICO_
const cmdFetch = `curl -k -s -X GET "${url}/rest/v1/entities?ico=like.NO_ICO_*" \\
    -H "apikey: ${key}" \\
    -H "Authorization: Bearer ${key}"`;
    
const dataStr = execSync(cmdFetch).toString();
let data;
try {
    data = JSON.parse(dataStr);
} catch(e) {
    console.error("Error parsing DB response:", dataStr);
    process.exit(1);
}

console.log(`Found ${data.length} entities with missing IČO.`);

for (const entity of data) {
    console.log(`Searching IČO for: ${entity.name}`);
    let cleanName = entity.name.replace(/&quot;/g, '"');
    const searchUrl = `https://finstat.sk/hladaj?Query=${encodeURIComponent(cleanName)}`;
    
    // Perform curl with redirect check (head request) to see if Finstat redirects to an exact match
    const curlSearch = `curl -s -o /dev/null -w "%{redirect_url}" "${searchUrl}"`;
    const redirectUrl = execSync(curlSearch).toString().trim();
    
    if (redirectUrl && redirectUrl.match(/finstat\.sk\/(\d{8})$/)) {
        const ico = redirectUrl.match(/finstat\.sk\/(\d{8})$/)[1];
        console.log(`Found IČO for ${entity.name} -> ${ico}. Updating DB...`);
        const encodedDbName = encodeURIComponent(entity.name);
        const patchCmd = `curl -k -s -X PATCH "${url}/rest/v1/entities?name=eq.${encodedDbName}" \\
          -H "apikey: ${key}" \\
          -H "Authorization: Bearer ${key}" \\
          -H "Content-Type: application/json" \\
          -H "Prefer: return=minimal" \\
          -d '{"ico":"${ico}"}'`;
        execSync(patchCmd);
    } else {
        console.log(`Could not automatically find exact match for ${entity.name}`);
    }
}
console.log("Finished searching and updating.");
