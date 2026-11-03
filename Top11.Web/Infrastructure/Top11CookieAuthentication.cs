using System.Net.Http.Headers;
using System.Text.Json;
using Microsoft.AspNetCore.Authentication;
using Microsoft.EntityFrameworkCore;
using Top11.Web.Database;
using Top11.Web.Database.Entities;

namespace Top11.Web.Infrastructure
{
	public static class Top11CookieAuthenticationDefaults
	{
		public const string AuthenticationScheme = "T11Auth";
		public const string Top11IdClimeName = "top11id";
	}

	public static class Top11CookieAuthenticationExtensions
	{
		public static void AddTop11CookieAuthentication(this IServiceCollection services, AppSettings settings)
		{
			services.AddAuthentication(Top11CookieAuthenticationDefaults.AuthenticationScheme)
				.AddCookie(Top11CookieAuthenticationDefaults.AuthenticationScheme, o =>
				{
					o.ExpireTimeSpan = TimeSpan.FromDays(7);
					o.SlidingExpiration = true;
				})
				.AddOAuth("google", o =>
				{
					o.SignInScheme = Top11CookieAuthenticationDefaults.AuthenticationScheme;
					o.ClientId = settings.GoogleClientId;
					o.ClientSecret = settings.GoogleClientSecret;

					o.AuthorizationEndpoint = "https://accounts.google.com/o/oauth2/auth";
					o.TokenEndpoint = "https://accounts.google.com/o/oauth2/token";
					o.CallbackPath = "/api/auth/google-callback";
					o.SaveTokens = true;

					o.Scope.Add("email");
					o.ClaimActions.MapAll();

					o.Events.OnTicketReceived = context =>
					{
						context.Properties!.IsPersistent = true;
						return Task.CompletedTask;
					};

					o.Events.OnCreatingTicket = async context =>
					{
						using var request = new HttpRequestMessage(HttpMethod.Get, "https://www.googleapis.com/oauth2/v2/userinfo");
						request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", context.AccessToken);
						using var response = await context.Backchannel.SendAsync(request, context.HttpContext.RequestAborted);
						response.EnsureSuccessStatusCode();
						var responseString = await response.Content.ReadAsStringAsync();
						context.RunClaimActions(JsonDocument.Parse(responseString).RootElement);

						var googleId = context.Identity!.FindFirst("id")!.Value;
						var email = context.Identity!.FindFirst("email")!.Value;

						var account = await GetOrCreateAccount();
						context.Identity!.AddClaim(new System.Security.Claims.Claim(Top11CookieAuthenticationDefaults.Top11IdClimeName, account.Id.ToString()));

						async Task<Account> GetOrCreateAccount()
						{
							var dbContext = context.HttpContext.RequestServices.GetRequiredService<Top11DbContext>();
							var account = await dbContext.Accounts.FirstOrDefaultAsync(t => t.GoogleId == googleId);
							if (account == null)
							{
								account = new Account()
								{
									GoogleId = googleId,
									Email = email,
									Teams = []
								};
								await dbContext.Accounts.AddAsync(account);
								await dbContext.SaveChangesAsync();
							}

							return account;
						};
					};
				});
		}
	}
}
