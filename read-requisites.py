import sys
import os
import json
import asyncio
import aiohttp
import requests
from bs4 import BeautifulSoup

courses = requests.get("https://programsandcourses.anu.edu.au/data/CourseSearch/GetCourses?ShowAll=true")

courses_data = courses.json()

urls = []
for course in courses_data["Items"]:
    urls.append((course["CourseCode"], f"https://programsandcourses.anu.edu.au/{course['Year']}/course/{course['CourseCode']}"))

# print(urls)

#######json.lo
#######courses_result_tree = ET.parse("./get-courses-results.xml")
#######root_courses_result_tree = courses_result_tree.getroot()
#######
#######for child in root_courses_result_tree:
#######    print(child)


# Initialize connection pool
conn = aiohttp.TCPConnector(limit_per_host=100, limit=0, ttl_dns_cache=300)
PARALLEL_REQUESTS = 100


results = []

NOT_OFFERED = 0
FIRST_SEM_OFFERED = 1
SECOND_SEM_OFFERED = 2
AUTUMN_OFFERED = 4
SPRING_OFFERED = 8
SUMMER_OFFERED = 16
WINTER_OFFERED = 32

counter = 0

async def gather_with_concurrency(n):
    semaphore = asyncio.Semaphore(n)

    async with aiohttp.ClientSession() as session:
        # heres the logic for the generator
        async def get(url):
            global counter
            async with semaphore:
                async with session.get(url[1], ssl=False) as response:
                    soup = BeautifulSoup(await response.read(), features="lxml")
                    requisite_obj = soup.find(class_ = "requisite")
                    requisite_formatted = None
                    if requisite_obj is not None:
                        requisite_formatted = "$".join([(str(node.contents[0]) if node.name == "a" else str(node)) for node in requisite_obj.contents])
                    degree_summary_nodes = soup.find_all(class_="degree-summary__code-text")

                    offered = 0
                    for node in degree_summary_nodes:
                        contents_stripped = str(node.contents[0]).strip()
                        if contents_stripped.startswith("First Semester"):
                            offered |= FIRST_SEM_OFFERED
                        elif contents_stripped.startswith("Second Semester"):
                            offered |= SECOND_SEM_OFFERED
                        elif contents_stripped.startswith("Autumn Session"):
                            offered |= AUTUMN_OFFERED
                        elif contents_stripped.startswith("Spring Session"):
                            offered |= SPRING_OFFERED
                        elif contents_stripped.startswith("Winter Session"):
                            offered |= WINTER_OFFERED
                        elif contents_stripped.startswith("Summer Session"):
                            offered |= SUMMER_OFFERED
                    
                    # Either the course isnt offered this year, or it isnt run any more,
                    # we need to be able to distinguish this by checking to see if there
                    # is anything in the class table
                    if offered == 0:
                        if soup.find(class_="course-tabs-menu") is None:
                            # It isnt offered so just dont report it
                            counter += 1
                            return



                    
                    results.append((url[0], offered, requisite_formatted))
                    counter += 1
                    progress = counter / len(urls) * 100
                    print("Done " + url[0] + f" \t {progress:.2f}%")

        await asyncio.gather(*(get(url) for url in urls))

asyncio.run(gather_with_concurrency(PARALLEL_REQUESTS))
conn.close()

with open("requirements-json.json", "w+") as dumpfile:
    json.dump(results, dumpfile)

print(f"Completed {len(urls)} requests with {len(results)} results")
