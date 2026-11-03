using Microsoft.EntityFrameworkCore;
using Top11.Web.Database;
using Top11.Web.Infrastructure;

namespace Top11.Web.Api.Auth
{
	public static class GetAccountInfo
	{
		public class Endpoint : IEndpoint
		{
			public class RequestDto
			{
				public int AccountId { get; set; }
			}

			public void MapEndpoint(IEndpointRouteBuilder app)
			{
				app.MapGet("api/auth/details", async (Top11DbContext top11DbContext, HttpContext context) =>
				{
					var weekActiveUsers = await top11DbContext.Accounts.Where(t => t.LastActivity > DateTime.Now.Date.AddDays(-7)).CountAsync();
					var claimAccountId = context.User.Claims.FirstOrDefault(t => t.Type == Top11CookieAuthenticationDefaults.Top11IdClimeName)?.Value;
					if (claimAccountId != null)
					{
						var accountId = int.Parse(claimAccountId);
						var account = await top11DbContext.Accounts.FindAsync(accountId);
						if (account != null)
						{
							account!.LastActivity = DateTime.Now;
							await top11DbContext.SaveChangesAsync();
						}
					}

					//var f = context.User.Claims.ToList();
					// await Task.Delay(3500);
					return TypedResults.Ok(new
					{
						context.User.Identity?.IsAuthenticated,
						Email = context.User.Claims.FirstOrDefault(t => t.Type == "email")?.Value ?? string.Empty,
						WeekActiveUsers = weekActiveUsers,
					});

				});// .RequireAuthorization();
			}
		}
	}
}
