namespace Top11.Web.Infrastructure
{
	public class AppSettings
	{
		public required string GoogleClientId { get; set; }
		public required string GoogleClientSecret { get; set; }

		public required ConnectionStringsSettings ConnectionStrings { get; set; }
		public class ConnectionStringsSettings
		{
			public required string Top11 { get; set; }
		}
	}
}
