const puppeteer = require('puppeteer');
const fs = require('fs');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function scrapeJobs(keyword) {
    const browser = await puppeteer.launch({ headless: false }); // Set headless to false for debugging
    const page = await browser.newPage();
    const timeout = 60000;
    const searchURL = `https://www.linkedin.com/jobs/search?keywords=${keyword}&location=Worldwide&trk=public_jobs_jobs-search-bar_search-submit&f_TP=1&redirect=false&position=1&pageNum=0`;
    
    await page.goto(searchURL, { waitUntil: 'networkidle2' });
    
    try {
        await page.waitForSelector('.base-card__full-link', { timeout });
    } catch (error) {
        console.error('Error: Job listings failed to load.');
        await browser.close();
        return;
    }
    
    const jobData = await page.evaluate(() => {
        const jobCards = document.querySelectorAll('.base-card__full-link');
        const jobs = [];
        const numberOfJobs=3

        jobCards.forEach(card => {
            const link = card.href;
            const jobTitle = card.querySelector('span.sr-only')?.innerText;

            jobs.push({
                jobTitle,
                applicationLink: link
            });
        });
        

        return jobs;
    });

    const jobQueue = jobData.map(job => job.applicationLink);

    async function processJobLink(link) {
        try {
            await page.goto(link, { waitUntil: 'networkidle2', timeout });
            await page.waitForSelector('.show-more-less-html__markup', { timeout })

            const jobDetails = await page.evaluate(() => {
            const jobDescription = document.querySelector('.show-more-less-html__markup')?.innerText;
            const companyName = document.querySelector('.topcard__org-name-link')?.innerText;
            const jobLocation = document.querySelector('.topcard__flavor--bullet')?.innerText;
            const jobPostDate = document.querySelector('.posted-time-ago__text')?.innerText;
                
            return { jobDescription, companyName, jobLocation, jobPostDate};
            });

            const job = jobData.find(job => job.applicationLink === link);
            if (job) {
                job.jobDescription = jobDetails.jobDescription;
                job.companyName = jobDetails.companyName;
                job.jobLocation = jobDetails.jobLocation;
                job.jobPostDate = jobDetails.jobPostDate;
                job.skills = jobDetails.skills;
            }
            
            return;
            
        } catch (error) {
            console.error(`Failed to process job link: ${link}`)
            await delay(2000);
        }
}

    while (jobQueue.length > 0) {
        const batch = jobQueue.splice(0, 1);
        await Promise.all(batch.map(link => processJobLink(link)));
        await delay(3000)
    }

    await browser.close();

    // Write data to a JSON file
    fs.writeFileSync('jobs.json', JSON.stringify(jobData, null, 2));

    console.log('Job data saved to jobs.json');
}

const keyword = process.argv[2] || 'MLOps'; // Default keyword is MLOps
scrapeJobs(keyword);
