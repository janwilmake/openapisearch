<!-- I made openapi for about 4 endpoint already. can easily make the rest too -->

To determine the total number of endpoints in the WakaTime API, I'll need to carefully count them from the documentation provided. Let me do that for you.

After reviewing the documentation, here's a list of the unique endpoints I've identified:

1. GET /api/v1/users/:user/all_time_since_today
2. GET /api/v1/users/:user/projects/:project/commits/:hash
3. GET /api/v1/users/:user/projects/:project/commits
4. GET /api/v1/users/:user/data_dumps
5. POST /api/v1/users/:user/data_dumps
6. GET /api/v1/users/:user/durations
7. GET /api/v1/editors
8. DELETE /api/v1/users/:user/external_durations.bulk
9. GET /api/v1/users/:user/external_durations
10. POST /api/v1/users/:user/external_durations
11. POST /api/v1/users/:user/external_durations.bulk
12. GET /api/v1/users/:user/goals/:goal
13. GET /api/v1/users/:user/goals
14. GET /api/v1/leaders
15. GET /api/v1/users/:user/machine_names
16. GET /api/v1/meta
17. GET /api/v1/users/:user/orgs/:org/dashboards/:dashboard/members/:member/durations
18. GET /api/v1/users/:user/orgs/:org/dashboards/:dashboard/members/:member/summaries
19. GET /api/v1/users/:user/orgs/:org/dashboards/:dashboard/members
20. GET /api/v1/users/:user/orgs/:org/dashboards
21. GET /api/v1/users/:user/orgs
22. GET /api/v1/users/:user/leaderboards
23. GET /api/v1/users/:user/leaderboards/:board
24. GET /api/v1/program_languages
25. GET /api/v1/users/:user/projects
26. GET /api/v1/users/:user/stats
27. GET /api/v1/users/:user/stats/:range
28. GET /api/v1/stats/:range
29. GET /api/v1/users/:user/status_bar/today
30. GET /api/v1/users/:user/summaries
31. GET /api/v1/users/:user/user_agents
32. GET /api/v1/users/:user
33. DELETE /api/v1/users/:user/heartbeats.bulk
34. GET /api/v1/users/:user/heartbeats
35. POST /api/v1/users/:user/heartbeats
36. POST /api/v1/users/:user/heartbeats.bulk

In total, there are 36 unique endpoints in the WakaTime API as described in the provided documentation.

It's worth noting that many of these endpoints have a variant that uses "current" instead of a specific user identifier, like:

GET /api/v1/users/current/stats

These variants are not counted separately as they functionally represent the same endpoint, just with a different user identifier.
