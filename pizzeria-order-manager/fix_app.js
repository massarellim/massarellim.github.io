const fs = require('fs');
let css = fs.readFileSync('frontend/src/App.css', 'utf8');

// The user said he didn't want the rest of the UI modified.
// Let's ensure menu-item doesn't cause overflow. We changed it to min-height: 0, height: 100%. This is fine.

fs.writeFileSync('frontend/src/App.css', css);
