import { expect, test } from "@playwright/test"

test("opens the redesigned Panda drawer and follows the AI request state", async ({
  page,
}) => {
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname
    let data: unknown = {}

    if (path === "/api/v1/auth/refresh") {
      data = { accessToken: "panda-drawer-token" }
    } else if (path === "/api/v1/auth/me") {
      data = {
        user: {
          id: "panda-drawer-user",
          name: "Nguyễn Văn Hiếu",
          email: "hieu@example.com",
          role: "user",
          status: "active",
          learningProfile: {
            currentHsk: 2,
            goal: "daily",
            topicIds: ["daily-life"],
            dailyMinutes: 20,
            surveyVersion: 1,
          },
        },
      }
    } else if (path === "/api/v1/lessons") {
      data = { items: [], page: 1, limit: 12, total: 0, pages: 0 }
    } else if (path === "/api/v1/learning/dashboard") {
      data = {
        metrics: {
          completedLessons: 0,
          savedWords: 0,
          dueWords: 0,
          averageQuizScore: null,
        },
        continueLearning: null,
        recentProgress: [],
        recentAttempts: [],
      }
    } else if (path === "/api/v1/learning/activity") {
      data = {
        days: [],
        totals: {
          activeStudySeconds: 0,
          progressUpdates: 0,
          quizAttempts: 0,
          completedLessons: 0,
        },
      }
    } else if (path === "/api/v1/learning/recommendations/ai") {
      data = { items: [] }
    } else if (path === "/api/v1/ai/ask") {
      await new Promise((resolve) => setTimeout(resolve, 1400))
      data = {
        answerVi:
          "了 (le) thường được dùng để đánh dấu một hành động đã hoàn thành.",
      }
    }

    await route.fulfill({ status: 200, json: { data } })
  })

  await page.goto("/")
  await page.getByRole("button", { name: "Mở trợ lý Panda AI" }).click()

  const drawer = page.getByRole("complementary", { name: "Trợ lý Panda AI" })
  await expect(drawer).toBeVisible()
  await expect(
    drawer.getByRole("heading", { name: "Trợ lý Panda AI" }),
  ).toBeVisible()
  await expect(drawer.getByText("Đang học:")).toBeVisible()
  await expect(drawer.getByText("HSK 2")).toBeVisible()
  await expect(
    drawer.getByRole("button", { name: "Giải thích từ" }),
  ).toBeVisible()
  await expect(
    drawer.getByRole("button", { name: "Luyện ngữ pháp" }),
  ).toBeVisible()
  await expect(
    drawer.getByPlaceholder("Hỏi Panda về bài học này..."),
  ).toBeVisible()

  await drawer.getByRole("button", { name: "Luyện ngữ pháp" }).click()
  await expect(
    drawer.getByText(
      "Giải thích ngữ pháp trong bài học này và cho ví dụ dễ hiểu",
    ),
  ).toBeVisible()
  await expect(page.getByTestId("panda-pet")).toHaveAttribute(
    "data-state",
    "working",
    {
      timeout: 2500,
    },
  )
  await expect(
    drawer.getByText(
      "了 (le) thường được dùng để đánh dấu một hành động đã hoàn thành.",
    ),
  ).toBeVisible()
  await expect(page.getByTestId("panda-pet")).toHaveAttribute(
    "data-state",
    "success",
  )
  await expect(page.getByTestId("panda-pet")).toHaveAttribute(
    "data-state",
    "idle",
    {
      timeout: 3500,
    },
  )
})
