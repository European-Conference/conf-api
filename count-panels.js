const { Pool } = require('pg');
const fs = require('fs');
const config = require('./config');

const pool = new Pool(config.database);
const outputFile = "panel_counts.txt";

let formattedTime = () => {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()} ${d.getHours()}:${d.getMinutes()}:${d.getSeconds()} UTC`;
}

process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0;
async function countPanelSelections() {
  const panelCounts = new Map();

  try {
    const res = await pool.query('SELECT preferences FROM attendees');
    let usersWithPreferences = 0;
    res.rows.forEach((row) => {
      if (!row.preferences) return;
      const panelsSelected = row.preferences.panelsSelected;

      if (!panelsSelected) return;

      usersWithPreferences++;

      panelsSelected.forEach((panel) => {
        if (panelCounts.has(panel)) {
          panelCounts.set(panel, panelCounts.get(panel) + 1);
        } else {
          panelCounts.set(panel, 1);
        }
      });
    });

    const sortedCounts = Array.from(panelCounts.entries()).sort((a, b) => b[1] - a[1]);

    let output = `Preferences for ${usersWithPreferences} attendees, as of ${formattedTime()}\nCount - Panel\n\n`;
    sortedCounts.forEach(([panel, count]) => {
      output += `${count} - ${panel}\n`;
    });

    fs.writeFileSync(outputFile, output, 'utf8');
    console.log(`Saved panel counts for ${usersWithPreferences} (out of ${res.rowCount} total) attendees to panel_counts.txt`);
  } catch (err) {
    console.error('Error fetching data from the database:', err);
  } finally {
    await pool.end();
  }
}

countPanelSelections();
