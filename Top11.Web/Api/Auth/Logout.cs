using Microsoft.AspNetCore.Authentication;
using Top11.Web.Infrastructure;

namespace Top11.Web.Api.Auth
{
	public static class Logout
	{
		public class Endpoint : IEndpoint
		{
			public void MapEndpoint(IEndpointRouteBuilder api)
			{
				api.MapPost("api/auth/logout", async (HttpContext context) =>
				{
					if (context.User.Identity != null && context.User.Identity.IsAuthenticated)
					{
						await context.SignOutAsync();
					}
				});
			}
		}
	}
}
