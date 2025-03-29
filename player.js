const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();

    console.log("Navigating to the tournament page...");
    await page.goto('https://www.espncricinfo.com/records/tournament/team-match-results/icc-men-s-t20-world-cup-2022-23-14450', { waitUntil: 'networkidle2' });

    // Extract match summary links
    const matchLinks = await page.evaluate(() => {
        let links = [];
        document.querySelectorAll('table tbody tr').forEach(row => {
            const anchor = row.querySelectorAll('td a');
            if (anchor.length > 0) {
                let rowURL = "https://www.espncricinfo.com" + anchor[anchor.length - 1].getAttribute('href');
                links.push(rowURL);
            }
        });
        return links;
    });
    

    console.log(`Extracted ${matchLinks.length} match links.`);

    let playersData = [];

    // Iterate through match links
    for (let matchUrl of matchLinks) {
        console.log(`Navigating to match page: ${matchUrl}`);
        await page.goto(matchUrl, { waitUntil: 'networkidle2' });

        const matchData = await page.evaluate(() => {
            let playersLinks = [];
            const teams = document.querySelectorAll('.ds-text-title-xs.ds-font-bold.ds-capitalize');
            let team1 = teams[0]?.innerText?.replace(" Innings", "").trim() || "Unknown Team 1";
            let team2 = teams[1]?.innerText?.replace(" Innings", "").trim() || "Unknown Team 2";

            let tables = document.querySelectorAll('table.ds-w-full.ds-table');

            // Batting players
            function extractPlayers(tableIndex, teamName) {
                let rows = tables[tableIndex]?.querySelectorAll('table.ds-w-full.ds-table') || [];
                rows.forEach(row => {
                    let playerCell = row.querySelector('td:first-child a');
                    let playerImageLink = row.querySelector('td:first-child a img'); // Select the image inside the link
                    if (playerImageLink && playerCell) {
                        playersLinks.push({
                            "name": playerCell.innerText.trim(),
                            "team": teamName,
                            "link": "https://www.espncricinfo.com" + playerCell.getAttribute('href'),
                            "image": playerImageLink.getAttribute('src') // Extract image URL
                        });
                    }
                });
            }
            

            extractPlayers(0, team1);
            extractPlayers(1, team2);

            // Bowling players
            function extractBowlers(tableIndex, teamName) {
                let rows = tables[tableIndex]?.querySelectorAll('tbody tr') || [];
                rows.forEach(row => {
                    let playerCell = row.querySelector('td:first-child a');
                    if (playerCell) {
                        playersLinks.push({
                            "name": playerCell.innerText.trim(),
                            "team": teamName,
                            "link": "https://www.espncricinfo.com" + playerCell.getAttribute('href')
                        });
                    }
                });
            }

            extractBowlers(1, team2);
            extractBowlers(3, team1);

            return playersLinks;
        });

        console.log(`Extracted ${matchData.length} players from match.`);
        playersData.push(...matchData);
    }

    console.log("Extracting individual player details...");

    let finalPlayersData = [];

    for (let player of playersData) {
        console.log(`Scraping data for ${player.name} (${player.team}) - ${player.link}`);
        try {
            await page.goto(player.link, { waitUntil: 'networkidle2' });

            const playerDetails = await page.evaluate(() => {
                function getInfo(label) {
                    let elements = document.querySelectorAll('p.ds-text-tight-s.ds-font-regular.ds-uppercase.ds-text-typo-mid3');
                    for (let el of elements) {
                        if (el.innerText.trim() === label) {
                            return el.nextElementSibling?.innerText.trim() || "N/A";
                        }
                    }
                    return "N/A";
                }
            
                return {
                    "battingStyle": getInfo('Batting Style'),
                    "bowlingStyle": getInfo('Bowling Style'),
                    "playingRole": getInfo('Playing Role'),
                    "description": document.querySelector('div.ci-player-bio-content p')?.innerText?.trim() || "No description available"
                };
            });
            

            finalPlayersData.push({
                "name": player.name,
                "team": player.team,
                "battingStyle": playerDetails.battingStyle,
                "bowlingStyle": playerDetails.bowlingStyle,
                "playingRole": playerDetails.playingRole,
                "description": playerDetails.description
            });

        } catch (error) {
            console.log(`Error scraping player ${player.name}: ${error.message}`);
        }
    }

    console.log(`Scraped data for ${finalPlayersData.length} players.`);

    // Save data to JSON file
    fs.writeFileSync('player.json', JSON.stringify(finalPlayersData, null, 2));
    console.log("Data saved to player.json!");

    await browser.close();
})();
